import express from "express";
import mongoose from "mongoose";
import Ticket from "../models/Ticket.js";
import User from "../models/User.js";
import { authGuard, requireRole } from "../middleware/auth.js";

const router = express.Router();

const buildId = (prefix) => {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${date}-${rand}`;
};

const buildLoadSummary = (load) => {
  return `${load.unitCount}@${load.dimensions.length}${load.dimensions.width}${load.dimensions.height} - CW-${load.totalWeight} KG`;
};

const pushNotification = async (filter, payload) => {
  await User.updateMany(filter, { $push: { notifications: payload } });
};

router.use(authGuard);

router.get("/", async (req, res) => {
  try {
    const filter = req.user.role === "customer" ? { customer: req.user.id } : {};
    const { status, origin, destination, dateFrom, dateTo } = req.query;

    if (status) {
      const normalizedStatus = status === "pending" ? "open" : status;
      filter.status = normalizedStatus;
    }
    if (origin) {
      filter.origin = new RegExp(origin, "i");
    }
    if (destination) {
      filter.destination = new RegExp(destination, "i");
    }

    const createdAt = {};
    if (dateFrom) {
      const start = new Date(dateFrom);
      if (!Number.isNaN(start.getTime())) {
        start.setHours(0, 0, 0, 0);
        createdAt.$gte = start;
      }
    }
    if (dateTo) {
      const end = new Date(dateTo);
      if (!Number.isNaN(end.getTime())) {
        end.setHours(23, 59, 59, 999);
        createdAt.$lte = end;
      }
    }
    if (Object.keys(createdAt).length > 0) {
      filter.createdAt = createdAt;
    }

    const tickets = await Ticket.find(filter).sort({ createdAt: -1 });
    return res.json(tickets);
  } catch (error) {
    return res.status(500).json({ message: "Failed to load tickets" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const baseFilter = req.user.role === "customer" ? { customer: req.user.id } : {};
    const { id } = req.params;
    let ticket = await Ticket.findOne({ ...baseFilter, ticketId: id });
    if (!ticket && mongoose.isValidObjectId(id)) {
      ticket = await Ticket.findOne({ ...baseFilter, _id: id });
    }
    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }
    return res.json(ticket);
  } catch (error) {
    return res.status(500).json({ message: "Failed to load ticket" });
  }
});

router.post("/", requireRole("customer"), async (req, res) => {
  try {
    const {
      origin,
      destination,
      cargoType,
      shipperIdStatus,
      loads,
      loadSummary,
      notes,
    } = req.body;
    if (!origin || !destination || !cargoType) {
      return res.status(400).json({ message: "All shipment fields are required" });
    }
    if (!shipperIdStatus || !["known", "unknown"].includes(shipperIdStatus)) {
      return res.status(400).json({ message: "Shipper ID status is required" });
    }
    if (!Array.isArray(loads) || loads.length === 0) {
      return res.status(400).json({ message: "At least one load is required" });
    }
    for (const load of loads) {
      if (!load.unitCount || !load.weightPerUnit || !load.totalWeight || !load.dimensions) {
        return res.status(400).json({ message: "Load details are required" });
      }
      if (!load.dimensions.length || !load.dimensions.width || !load.dimensions.height || !load.dimensions.unit) {
        return res.status(400).json({ message: "Dimensions are required" });
      }
    }
    const sanitizedLoads = loads.map((load) => ({
      unitCount: Number(load.unitCount),
      weightPerUnit: Number(load.weightPerUnit),
      totalWeight: Number(load.totalWeight),
      dimensions: {
        length: Number(load.dimensions.length),
        width: Number(load.dimensions.width),
        height: Number(load.dimensions.height),
        unit: load.dimensions.unit,
      },
      stackable: Boolean(load.stackable),
      turnable: Boolean(load.turnable),
      summary: load.summary || buildLoadSummary(load),
    }));
    const summaries = Array.isArray(loadSummary) && loadSummary.length > 0
      ? loadSummary
      : sanitizedLoads.map((load) => load.summary);
    const ticket = await Ticket.create({
      ticketId: buildId("TCK"),
      customer: req.user.id,
      customerName: req.user.name,
      origin,
      destination,
      cargoType,
      shipperIdStatus,
      loads: sanitizedLoads,
      loadSummary: summaries,
      notes,
      status: "open",
    });
    await pushNotification(
      { role: "admin", isDeleted: false },
      {
        title: "New tender submitted",
        message: `Ticket ${ticket.ticketId} created by ${req.user.name}.`,
        type: "tender",
        ticketId: ticket.ticketId,
      }
    );
    return res.status(201).json(ticket);
  } catch (error) {
    return res.status(500).json({ message: "Failed to create ticket" });
  }
});

router.patch("/:ticketId/status", requireRole("employee", "admin"), async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ["open", "quoted", "in_transit", "closed"];
    if (!allowed.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }
    const ticket = await Ticket.findOneAndUpdate(
      { ticketId: req.params.ticketId },
      { status },
      { new: true }
    );
    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }
    return res.json(ticket);
  } catch (error) {
    return res.status(500).json({ message: "Failed to update status" });
  }
});

router.patch("/:ticketId/assign", requireRole("admin"), async (req, res) => {
  try {
    const { employeeId } = req.body;
    if (!employeeId) {
      const ticket = await Ticket.findOneAndUpdate(
        { ticketId: req.params.ticketId },
        { assignedEmployee: null, assignedEmployeeName: null, assignedEmployeeId: null },
        { new: true }
      );
      if (!ticket) {
        return res.status(404).json({ message: "Ticket not found" });
      }
      return res.json(ticket);
    }
    const employee = await User.findOne({ _id: employeeId, role: "employee", isDeleted: false });
    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }
    const ticket = await Ticket.findOneAndUpdate(
      { ticketId: req.params.ticketId },
      {
        assignedEmployee: employee._id,
        assignedEmployeeName: employee.name,
        assignedEmployeeId: employee.employeeId,
      },
      { new: true }
    );
    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }
    await pushNotification(
      { _id: employee._id },
      {
        title: "New tender assigned",
        message: `Ticket ${ticket.ticketId} has been assigned to you.`,
        type: "assignment",
        ticketId: ticket.ticketId,
      }
    );
    return res.json(ticket);
  } catch (error) {
    return res.status(500).json({ message: "Failed to assign employee" });
  }
});

router.post("/:ticketId/quote", requireRole("employee"), async (req, res) => {
  try {
    const {
      carrier,
      serviceType,
      rate,
      currency,
      transitTime,
      validity,
      remarks,
      chargeableWeight,
      totalAmount,
      quoteDate,
    } = req.body;
    if (!carrier || !rate) {
      return res.status(400).json({ message: "Carrier and rate are required" });
    }
    if (Number.isNaN(Number(rate))) {
      return res.status(400).json({ message: "Rate must be numeric" });
    }
    if (chargeableWeight && Number.isNaN(Number(chargeableWeight))) {
      return res.status(400).json({ message: "Chargeable weight must be numeric" });
    }
    if (totalAmount && Number.isNaN(Number(totalAmount))) {
      return res.status(400).json({ message: "Total amount must be numeric" });
    }
    const ticket = await Ticket.findOne({ ticketId: req.params.ticketId });
    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }
    ticket.quotes.push({
      quoteId: buildId("QTE"),
      carrier,
      serviceType,
      rate: Number(rate),
      currency: currency || "USD",
      transitTime,
      validity,
      remarks,
      chargeableWeight: chargeableWeight ? Number(chargeableWeight) : undefined,
      totalAmount: totalAmount ? Number(totalAmount) : undefined,
      quoteDate: quoteDate || new Date().toISOString().slice(0, 10),
      status: "sent",
      createdBy: req.user.id,
      createdByName: req.user.name,
    });
    ticket.status = "quoted";
    await ticket.save();
    await pushNotification(
      { _id: ticket.customer },
      {
        title: "Quote submitted",
        message: `Quote sent for ticket ${ticket.ticketId}.`,
        type: "quote",
        ticketId: ticket.ticketId,
      }
    );
    return res.json(ticket);
  } catch (error) {
    return res.status(500).json({ message: "Failed to send quote" });
  }
});

router.post("/:ticketId/confirm", requireRole("customer"), async (req, res) => {
  try {
    const ticket = await Ticket.findOne({ ticketId: req.params.ticketId, customer: req.user.id });
    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }
    if (!ticket.quotes || ticket.quotes.length === 0) {
      return res.status(400).json({ message: "Quote not available" });
    }
    ticket.quotes[ticket.quotes.length - 1].status = "accepted";
    ticket.status = "in_transit";
    await ticket.save();
    if (ticket.assignedEmployee) {
      await pushNotification(
        { _id: ticket.assignedEmployee },
        {
          title: "Quote accepted",
          message: `Customer accepted quote for ticket ${ticket.ticketId}.`,
          type: "quote",
          ticketId: ticket.ticketId,
        }
      );
    }
    return res.json(ticket);
  } catch (error) {
    return res.status(500).json({ message: "Failed to confirm quote" });
  }
});

router.post("/:ticketId/reopen", requireRole("customer"), async (req, res) => {
  try {
    const ticket = await Ticket.findOne({ ticketId: req.params.ticketId, customer: req.user.id });
    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }
    ticket.status = "open";
    if (ticket.quotes && ticket.quotes.length > 0) {
      ticket.quotes[ticket.quotes.length - 1].status = "rejected";
    }
    await ticket.save();
    if (ticket.assignedEmployee) {
      await pushNotification(
        { _id: ticket.assignedEmployee },
        {
          title: "Quote reopened",
          message: `Customer requested changes for ticket ${ticket.ticketId}.`,
          type: "quote",
          ticketId: ticket.ticketId,
        }
      );
    }
    return res.json(ticket);
  } catch (error) {
    return res.status(500).json({ message: "Failed to reopen ticket" });
  }
});

router.post("/:ticketId/close", requireRole("employee", "admin"), async (req, res) => {
  try {
    const { bookedOn, finalRate, awbNumber, screenshotUrl, closingNotes } = req.body;
    if (!bookedOn || !finalRate || !awbNumber) {
      return res.status(400).json({ message: "Booked on, final rate, and AWB number are required" });
    }
    if (!/^[A-Za-z0-9-]+$/.test(awbNumber)) {
      return res.status(400).json({ message: "Invalid AWB format" });
    }
    if (Number.isNaN(Number(finalRate))) {
      return res.status(400).json({ message: "Final rate must be numeric" });
    }
    const ticket = await Ticket.findOne({ ticketId: req.params.ticketId });
    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }
    ticket.bookedOn = bookedOn;
    ticket.finalRate = Number(finalRate);
    ticket.awbNumber = awbNumber;
    ticket.screenshotUrl = screenshotUrl || null;
    ticket.closingNotes = closingNotes || "";
    ticket.closedBy = req.user.id;
    ticket.closedByName = req.user.name;
    ticket.closedAt = new Date().toISOString();
    ticket.status = "closed";
    await ticket.save();
    await pushNotification(
      { _id: ticket.customer },
      {
        title: "Ticket closed",
        message: `Ticket ${ticket.ticketId} has been closed.`,
        type: "closure",
        ticketId: ticket.ticketId,
      }
    );
    await pushNotification(
      { role: "admin", isDeleted: false },
      {
        title: "Ticket closed",
        message: `Ticket ${ticket.ticketId} closed by ${req.user.name}.`,
        type: "closure",
        ticketId: ticket.ticketId,
      }
    );
    return res.json(ticket);
  } catch (error) {
    return res.status(500).json({ message: "Failed to close ticket" });
  }
});

router.post("/:ticketId/book", requireRole("employee"), async (req, res) => {
  try {
    const { reference, notes } = req.body;
    if (!reference) {
      return res.status(400).json({ message: "Booking reference required" });
    }
    const ticket = await Ticket.findOne({ ticketId: req.params.ticketId });
    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }
    ticket.booking = {
      bookingId: buildId("BKG"),
      reference,
      notes,
      bookedBy: req.user.id,
    };
    ticket.status = "closed";
    await ticket.save();
    await pushNotification(
      { _id: ticket.customer },
      {
        title: "Booking completed",
        message: `Booking added for ticket ${ticket.ticketId}.`,
        type: "booking",
        ticketId: ticket.ticketId,
      }
    );
    return res.json(ticket);
  } catch (error) {
    return res.status(500).json({ message: "Failed to book shipment" });
  }
});

export default router;
