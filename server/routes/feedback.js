import express from "express";
import Feedback from "../models/Feedback.js";
import { authGuard, requireRole } from "../middleware/auth.js";
import { isValidName, normalizeName } from "../utils/validation.js";
import { sendError, sendSuccess } from "../utils/response.js";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const rawName = req.body.name || "";
    const name = normalizeName(rawName);
    const email = req.body.email?.trim().toLowerCase();
    const message = req.body.message?.trim();
    if (!name || !email || !message) {
      return sendError(res, "All fields are required", 400);
    }
    if (!isValidName(rawName)) {
      return sendError(res, "Name can contain only letters and spaces", 400);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return sendError(res, "Invalid email", 400);
    }
    const feedback = await Feedback.create({ name, email, message, status: "new" });
    return sendSuccess(res, feedback, "Feedback submitted", 201);
  } catch (error) {
    return sendError(res, "Failed to submit feedback", 500);
  }
});

router.get("/", authGuard, requireRole("admin"), async (req, res) => {
  try {
    const feedback = await Feedback.find().sort({ createdAt: -1 });
    return sendSuccess(res, { items: feedback }, "Feedback loaded");
  } catch (error) {
    return sendError(res, "Failed to load feedback", 500);
  }
});

router.patch("/:id/read", authGuard, requireRole("admin"), async (req, res) => {
  try {
    const feedback = await Feedback.findByIdAndUpdate(
      req.params.id,
      { status: "read" },
      { new: true }
    );
    if (!feedback) {
      return sendError(res, "Feedback not found", 404);
    }
    return sendSuccess(res, feedback, "Feedback updated");
  } catch (error) {
    return sendError(res, "Failed to update feedback", 500);
  }
});

router.delete("/:id", authGuard, requireRole("admin"), async (req, res) => {
  try {
    const feedback = await Feedback.findByIdAndDelete(req.params.id);
    if (!feedback) {
      return sendError(res, "Feedback not found", 404);
    }
    return sendSuccess(res, { deleted: true }, "Feedback deleted");
  } catch (error) {
    return sendError(res, "Failed to delete feedback", 500);
  }
});

export default router;
