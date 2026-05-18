import express from "express";
import Ticket from "../models/Ticket.js";
import { authGuard, requireRole } from "../middleware/auth.js";
import { sendError, sendSuccess } from "../utils/response.js";

const router = express.Router();

router.use(authGuard);

router.get("/stats", requireRole("admin", "employee"), async (req, res) => {
  try {
    const filter = {};
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const [
      totalTickets,
      pendingTickets,
      assignedTickets,
      quotedTickets,
      acceptedTickets,
      bookedTickets,
      closedTickets,
      todayTickets,
    ] = await Promise.all([
      Ticket.countDocuments(filter),
      Ticket.countDocuments({ ...filter, status: { $in: ["pending", "open"] } }),
      Ticket.countDocuments({ ...filter, status: "assigned" }),
      Ticket.countDocuments({ ...filter, status: "quoted" }),
      Ticket.countDocuments({ ...filter, status: "accepted" }),
      Ticket.countDocuments({ ...filter, status: { $in: ["booked", "in_transit"] } }),
      Ticket.countDocuments({ ...filter, status: "closed" }),
      Ticket.countDocuments({ ...filter, createdAt: { $gte: todayStart, $lte: todayEnd } }),
    ]);

    return sendSuccess(res, {
      totalTickets,
      pendingTickets,
      assignedTickets,
      quotedTickets,
      acceptedTickets,
      bookedTickets,
      closedTickets,
      todayTickets,
    }, "Dashboard stats loaded");
  } catch (error) {
    return sendError(res, "Failed to load dashboard stats", 500);
  }
});

export default router;
