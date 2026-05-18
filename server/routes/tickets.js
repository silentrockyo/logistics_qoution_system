import express from "express";
import mongoose from "mongoose";
import Ticket from "../models/Ticket.js";
import User from "../models/User.js";
import { authGuard, requireRole } from "../middleware/auth.js";
import { sendError, sendSuccess } from "../utils/response.js";

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

const normalizeStatus = (status) => {
  if (!status) return status;
  if (status === "open") return "pending";
  if (status === "in_transit") return "booked";
  return status;
};

const statusFilterValues = (status) => {
  if (!status) return null;
  if (status === "pending") return ["pending", "open"];
  if (status === "booked") return ["booked", "in_transit"];
  return [status];
};

const mapTicket = (ticket) => {
  const obj = ticket.toObject();
  obj.status = normalizeStatus(obj.status);
  return obj;
};

const parseNumber = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

router.use(authGuard);

router.get("/", async (req, res) => {
  try {
    const filter = {};
    if (req.user.role === "customer") {
      filter.$or = [{ customerId: req.user.id }, { customer: req.user.id }];
    } else if (req.user.role === "employee") {
      filter.$or = [
        { assignedEmployeeId: req.user.id },
        { assignedEmployee: req.user.id },
        {
          assignedEmployeeId: { $in: [null, undefined] },
          assignedEmployee: { $in: [null, undefined] },
          status: { $in: ["pending", "open"] },
        },
      ];
    }

    const { status, origin, destination, dateFrom, dateTo } = req.query;
    const statusValues = statusFilterValues(status);
    if (statusValues) {
      filter.status = { $in: statusValues };
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

    const page = Math.max(1, parseNumber(req.query.page, 1));
    const limit = Math.min(100, Math.max(1, parseNumber(req.query.limit, 20)));
    const skip = (page - 1) * limit;

    const [total, tickets] = await Promise.all([
      Ticket.countDocuments(filter),
      Ticket.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    ]);

    const items = tickets.map(mapTicket);
    return sendSuccess(res, {
      items,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    }, "Tickets loaded");
  } catch (error) {
    return sendError(res, "Failed to load tickets", 500);
  }
});

router.get("/:id", async (req, res) => {
  try {
    const baseFilter = {};
    if (req.user.role === "customer") {
      baseFilter.$or = [{ customerId: req.user.id }, { customer: req.user.id }];
    }
    const { id } = req.params;
    let ticket = await Ticket.findOne({ ...baseFilter, ticketId: id });
    if (!ticket && mongoose.isValidObjectId(id)) {
      ticket = await Ticket.findOne({ ...baseFilter, _id: id });
    }
    if (!ticket) {
      return sendError(res, "Ticket not found", 404);
    }
    return sendSuccess(res, mapTicket(ticket), "Ticket loaded");
  } catch (error) {
    return sendError(res, "Failed to load ticket", 500);
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
      return sendError(res, "All shipment fields are required", 400);
    }
    if (!shipperIdStatus || !["known", "unknown"].includes(shipperIdStatus)) {
      return sendError(res, "Shipper ID status is required", 400);
    }
    if (!Array.isArray(loads) || loads.length === 0) {
      return sendError(res, "At least one load is required", 400);
    }
    for (const load of loads) {
      if (!load.unitCount || !load.weightPerUnit || !load.totalWeight || !load.dimensions) {
        return sendError(res, "Load details are required", 400);
      }
      if (!load.dimensions.length || !load.dimensions.width || !load.dimensions.height || !load.dimensions.unit) {
        return sendError(res, "Dimensions are required", 400);
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
      customerId: req.user.id,
      customerName: req.user.name,
      origin,
      destination,
      cargoType,
      shipperIdStatus,
      loads: sanitizedLoads,
      loadSummary: summaries,
      notes,
      status: "pending",
      assignedEmployee: null,
      assignedEmployeeId: null,
      assignedEmployeeName: null,
      assignedEmployeeCode: null,
    });
    await pushNotification(
      { role: "admin", isDeleted: { $ne: true } },
      {
        title: "New tender submitted",
        message: `Ticket ${ticket.ticketId} created by ${req.user.name}.`,
        type: "tender",
        ticketId: ticket.ticketId,
      }
    );
    return sendSuccess(res, mapTicket(ticket), "Ticket created", 201);
  } catch (error) {
    return sendError(res, "Failed to create ticket", 500);
  }
});

router.patch("/:ticketId/status", requireRole("employee", "admin"), async (req, res) => {
  try {
    const { status } = req.body;
    const transitionMap = {
      pending: ["assigned"],
      assigned: ["quoted"],
      quoted: ["accepted"],
      accepted: ["booked"],
      booked: ["closed"],
    };
    const ticket = await Ticket.findOne({ ticketId: req.params.ticketId });
    if (!ticket) {
      return sendError(res, "Ticket not found", 404);
    }
    const currentStatus = normalizeStatus(ticket.status);
    if (currentStatus === "closed") {
      return sendError(res, "Ticket already closed", 400);
    }
    const allowed = transitionMap[currentStatus] || [];
    if (!allowed.includes(status)) {
      return sendError(res, "Invalid status transition", 400);
    }
    const updated = await Ticket.findOneAndUpdate(
      { _id: ticket._id, status: ticket.status },
      { status },
      { new: true }
    );
    if (!updated) {
      return sendError(res, "Ticket already updated by another user", 409);
    }
    return sendSuccess(res, mapTicket(updated), "Status updated");
  } catch (error) {
    return sendError(res, "Failed to update status", 500);
  }
});

router.patch("/:ticketId/assign", requireRole("admin"), async (req, res) => {
  try {
    const { employeeId } = req.body;
    const ticket = await Ticket.findOne({ ticketId: req.params.ticketId });
    if (!ticket) {
      return sendError(res, "Ticket not found", 404);
    }
    const normalizedStatus = normalizeStatus(ticket.status);
    if (normalizedStatus === "closed") {
      return sendError(res, "Ticket already closed", 400);
    }

    if (!employeeId) {
      const nextStatus = normalizedStatus === "assigned" ? "pending" : normalizedStatus;
      const updated = await Ticket.findOneAndUpdate(
        { _id: ticket._id, status: ticket.status },
        {
          assignedEmployee: null,
          assignedEmployeeId: null,
          assignedEmployeeName: null,
          assignedEmployeeCode: null,
          status: nextStatus,
        },
        { new: true }
      );
      if (!updated) {
        return sendError(res, "Ticket already updated by another user", 409);
      }
      return sendSuccess(res, mapTicket(updated), "Ticket unassigned");
    }

    const employee = await User.findOne({ _id: employeeId, role: "employee", isDeleted: { $ne: true } });
    if (!employee) {
      return sendError(res, "Employee not found", 404);
    }
    const nextStatus = normalizedStatus === "pending" ? "assigned" : normalizedStatus;
    const updated = await Ticket.findOneAndUpdate(
      { _id: ticket._id, status: ticket.status },
      {
        assignedEmployee: employee._id,
        assignedEmployeeId: employee._id,
        assignedEmployeeName: employee.name,
        assignedEmployeeCode: employee.employeeId,
        status: nextStatus,
      },
      { new: true }
    );
    if (!updated) {
      return sendError(res, "Ticket already updated by another user", 409);
    }
    await pushNotification(
      { _id: employee._id },
      {
        title: "New tender assigned",
        message: `Ticket ${updated.ticketId} has been assigned to you.`,
        type: "assignment",
        ticketId: updated.ticketId,
      }
    );
    return sendSuccess(res, mapTicket(updated), "Ticket assigned");
  } catch (error) {
    return sendError(res, "Failed to assign employee", 500);
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
      return sendError(res, "Carrier and rate are required", 400);
    }
    if (Number.isNaN(Number(rate))) {
      return sendError(res, "Rate must be numeric", 400);
    }
    if (chargeableWeight && Number.isNaN(Number(chargeableWeight))) {
      return sendError(res, "Chargeable weight must be numeric", 400);
    }
    if (totalAmount && Number.isNaN(Number(totalAmount))) {
      return sendError(res, "Total amount must be numeric", 400);
    }

    const employee = await User.findById(req.user.id).lean();
    if (!employee) {
      return sendError(res, "Employee not found", 404);
    }

    const quote = {
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
    };

    const ticket = await Ticket.findOneAndUpdate(
      {
        ticketId: req.params.ticketId,
        status: { $in: ["pending", "assigned", "open"] },
        $or: [
          { assignedEmployeeId: req.user.id },
          { assignedEmployee: req.user.id },
          { assignedEmployeeId: { $in: [null, undefined] } },
          { assignedEmployee: { $in: [null, undefined] } },
        ],
      },
      {
        $push: { quotes: quote },
        $set: {
          status: "quoted",
          quotedBy: req.user.id,
          quoteDetails: quote,
          assignedEmployee: employee._id,
          assignedEmployeeId: employee._id,
          assignedEmployeeName: employee.name,
          assignedEmployeeCode: employee.employeeId,
        },
      },
      { new: true }
    );

    if (!ticket) {
      return sendError(res, "Ticket not available for quoting", 409);
    }

    await pushNotification(
      { _id: ticket.customer },
      {
        title: "Quote submitted",
        message: `Quote sent for ticket ${ticket.ticketId}.`,
        type: "quote",
        ticketId: ticket.ticketId,
      }
    );
    return sendSuccess(res, mapTicket(ticket), "Quote sent");
  } catch (error) {
    return sendError(res, "Failed to send quote", 500);
  }
});

router.post("/:ticketId/confirm", requireRole("customer"), async (req, res) => {
  try {
    const ticket = await Ticket.findOne({
      ticketId: req.params.ticketId,
      $or: [{ customerId: req.user.id }, { customer: req.user.id }],
    });
    if (!ticket) {
      return sendError(res, "Ticket not found", 404);
    }
    const normalizedStatus = normalizeStatus(ticket.status);
    if (normalizedStatus !== "quoted") {
      return sendError(res, "Ticket is not ready for confirmation", 400);
    }
    if (!ticket.quotes || ticket.quotes.length === 0) {
      return sendError(res, "Quote not available", 400);
    }
    const lastQuote = ticket.quotes[ticket.quotes.length - 1];
    const updated = await Ticket.findOneAndUpdate(
      { _id: ticket._id, status: ticket.status },
      {
        $set: {
          status: "accepted",
          quoteDetails: { ...lastQuote.toObject(), status: "accepted" },
          "quotes.$[quote].status": "accepted",
        },
      },
      {
        new: true,
        arrayFilters: [{ "quote.quoteId": lastQuote.quoteId }],
      }
    );
    if (!updated) {
      return sendError(res, "Ticket already updated by another user", 409);
    }
    if (updated.assignedEmployee) {
      await pushNotification(
        { _id: updated.assignedEmployee },
        {
          title: "Quote accepted",
          message: `Customer accepted quote for ticket ${updated.ticketId}.`,
          type: "quote",
          ticketId: updated.ticketId,
        }
      );
    }
    return sendSuccess(res, mapTicket(updated), "Quote confirmed");
  } catch (error) {
    return sendError(res, "Failed to confirm quote", 500);
  }
});

router.post("/:ticketId/reopen", requireRole("customer"), async (req, res) => {
  try {
    const ticket = await Ticket.findOne({
      ticketId: req.params.ticketId,
      $or: [{ customerId: req.user.id }, { customer: req.user.id }],
    });
    if (!ticket) {
      return sendError(res, "Ticket not found", 404);
    }
    const normalizedStatus = normalizeStatus(ticket.status);
    if (!['quoted', 'accepted'].includes(normalizedStatus)) {
      return sendError(res, "Ticket is not ready to reopen", 400);
    }
    const lastQuote = ticket.quotes?.[ticket.quotes.length - 1];
    if (!lastQuote) {
      return sendError(res, "Quote not available", 400);
    }
    const nextStatus = ticket.assignedEmployee ? "assigned" : "pending";
    const updated = await Ticket.findOneAndUpdate(
      { _id: ticket._id, status: ticket.status },
      {
        $set: {
          status: nextStatus,
          "quotes.$[quote].status": "rejected",
        },
      },
      {
        new: true,
        arrayFilters: [{ "quote.quoteId": lastQuote.quoteId }],
      }
    );
    if (!updated) {
      return sendError(res, "Ticket already updated by another user", 409);
    }
    if (updated.assignedEmployee) {
      await pushNotification(
        { _id: updated.assignedEmployee },
        {
          title: "Quote reopened",
          message: `Customer requested changes for ticket ${updated.ticketId}.`,
          type: "quote",
          ticketId: updated.ticketId,
        }
      );
    }
    return sendSuccess(res, mapTicket(updated), "Ticket reopened");
  } catch (error) {
    return sendError(res, "Failed to reopen ticket", 500);
  }
});

router.post("/:ticketId/book", requireRole("employee", "admin"), async (req, res) => {
  try {
    const { reference, notes } = req.body;
    if (!reference) {
      return sendError(res, "Booking reference required", 400);
    }
    const booking = {
      bookingId: buildId("BKG"),
      reference,
      notes,
      bookedBy: req.user.id,
      bookedAt: new Date(),
    };
    const ticket = await Ticket.findOneAndUpdate(
      { ticketId: req.params.ticketId, status: { $in: ["accepted", "in_transit"] } },
      {
        $set: {
          booking,
          bookingConfirmation: booking,
          confirmedBy: req.user.id,
          status: "booked",
        },
      },
      { new: true }
    );
    if (!ticket) {
      return sendError(res, "Ticket is not ready for booking", 409);
    }
    await pushNotification(
      { _id: ticket.customer },
      {
        title: "Booking completed",
        message: `Booking added for ticket ${ticket.ticketId}.`,
        type: "booking",
        ticketId: ticket.ticketId,
      }
    );
    return sendSuccess(res, mapTicket(ticket), "Booking saved");
  } catch (error) {
    return sendError(res, "Failed to book shipment", 500);
  }
});

router.post("/:ticketId/close", requireRole("employee", "admin"), async (req, res) => {
  try {
    const { bookedOn, finalRate, awbNumber, screenshotUrl, closingNotes } = req.body;
    if (!bookedOn || !finalRate || !awbNumber) {
      return sendError(res, "Booked on, final rate, and AWB number are required", 400);
    }
    if (!/^[A-Za-z0-9-]+$/.test(awbNumber)) {
      return sendError(res, "Invalid AWB format", 400);
    }
    if (Number.isNaN(Number(finalRate))) {
      return sendError(res, "Final rate must be numeric", 400);
    }

    const updated = await Ticket.findOneAndUpdate(
      { ticketId: req.params.ticketId, status: { $in: ["booked", "in_transit"] } },
      {
        $set: {
          bookedOn,
          finalRate: Number(finalRate),
          awbNumber,
          screenshotUrl: screenshotUrl || null,
          closingNotes: closingNotes || "",
          closedBy: req.user.id,
          closedByName: req.user.name,
          closedAt: new Date().toISOString(),
          status: "closed",
        },
      },
      { new: true }
    );

    if (!updated) {
      const existing = await Ticket.findOne({ ticketId: req.params.ticketId });
      if (!existing) {
        return sendError(res, "Ticket not found", 404);
      }
      const normalizedStatus = normalizeStatus(existing.status);
      if (normalizedStatus === "closed") {
        return sendError(res, "Ticket already closed by another employee.", 409);
      }
      return sendError(res, "Ticket is not ready to close", 409);
    }

    await pushNotification(
      { _id: updated.customer },
      {
        title: "Ticket closed",
        message: `Ticket ${updated.ticketId} has been closed.`,
        type: "closure",
        ticketId: updated.ticketId,
      }
    );
    await pushNotification(
      { role: "admin", isDeleted: { $ne: true } },
      {
        title: "Ticket closed",
        message: `Ticket ${updated.ticketId} closed by ${req.user.name}.`,
        type: "closure",
        ticketId: updated.ticketId,
      }
    );
    return sendSuccess(res, mapTicket(updated), "Ticket closed");
  } catch (error) {
    return sendError(res, "Failed to close ticket", 500);
  }
});

export default router;
