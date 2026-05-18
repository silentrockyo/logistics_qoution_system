import express from "express";
import User from "../models/User.js";
import { authGuard } from "../middleware/auth.js";
import { sendError, sendSuccess } from "../utils/response.js";

const router = express.Router();

router.use(authGuard);

router.get("/", async (req, res) => {
  try {
    const user = await User.findById(req.user.id).lean();
    if (!user) {
      return sendError(res, "User not found", 404);
    }
    const notifications = (user.notifications || []).sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
    return sendSuccess(res, { items: notifications }, "Notifications loaded");
  } catch (error) {
    return sendError(res, "Failed to load notifications", 500);
  }
});

router.patch("/read", async (req, res) => {
  try {
    const { id, all } = req.body;
    if (all) {
      await User.updateOne(
        { _id: req.user.id },
        { $set: { "notifications.$[].read": true } }
      );
    } else if (id) {
      await User.updateOne(
        { _id: req.user.id, "notifications._id": id },
        { $set: { "notifications.$.read": true } }
      );
    } else {
      return sendError(res, "Notification id or all is required", 400);
    }
    const user = await User.findById(req.user.id).lean();
    return sendSuccess(res, { items: user.notifications || [] }, "Notifications updated");
  } catch (error) {
    return sendError(res, "Failed to update notifications", 500);
  }
});

router.delete("/", async (req, res) => {
  try {
    await User.updateOne({ _id: req.user.id }, { $set: { notifications: [] } });
    return sendSuccess(res, { items: [] }, "Notifications cleared");
  } catch (error) {
    return sendError(res, "Failed to clear notifications", 500);
  }
});

export default router;
