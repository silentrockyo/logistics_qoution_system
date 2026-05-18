import express from "express";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import Ticket from "../models/Ticket.js";
import { authGuard } from "../middleware/auth.js";
import { isValidEmail, isValidName, isValidPhone, normalizeName, normalizePhone } from "../utils/validation.js";
import { sendError, sendSuccess } from "../utils/response.js";

const router = express.Router();

router.use(authGuard);

router.get("/me", async (req, res) => {
  try {
    const user = await User.findById(req.user.id).lean();
    if (!user || user.isDeleted) {
      return sendError(res, "User not found", 404);
    }

    let assignedTicketsCount = 0;
    let activeTendersCount = 0;

    if (user.role === "employee") {
      assignedTicketsCount = await Ticket.countDocuments({ assignedEmployee: user._id });
    }

    if (user.role === "customer") {
      activeTendersCount = await Ticket.countDocuments({ customer: user._id, status: { $ne: "closed" } });
    }

    return sendSuccess(res, {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      phoneCountryCode: user.phoneCountryCode || "",
      phoneNumber: user.phoneNumber || "",
      company: user.company || "",
      department: user.department || "",
      roleLevel: user.roleLevel || "",
      employeeId: user.employeeId || "",
      branch: user.branch || "",
      avatarUrl: user.avatarUrl || "",
      preferences: user.preferences || {},
      joinedAt: user.createdAt,
      assignedTicketsCount,
      activeTendersCount,
    }, "Profile loaded");
  } catch (error) {
    return sendError(res, "Failed to load profile", 500);
  }
});

router.put("/profile", async (req, res) => {
  try {
    const {
      name,
      email,
      phoneCountryCode,
      phoneNumber,
      company,
      avatarUrl,
      preferences,
    } = req.body;

    const normalizedName = name ? normalizeName(name) : "";
    const normalizedPhone = phoneNumber ? normalizePhone(phoneNumber) : "";

    if (name != null && !isValidName(name)) {
      return sendError(res, "Name can contain only letters and spaces", 400);
    }

    if (phoneNumber && !isValidPhone(normalizedPhone)) {
      return sendError(res, "Phone number must be 10 digits", 400);
    }

    if (email) {
      const normalizedEmail = email.trim().toLowerCase();
      if (!isValidEmail(normalizedEmail)) {
        return sendError(res, "Invalid email", 400);
      }
      const existing = await User.findOne({ email: normalizedEmail, _id: { $ne: req.user.id } });
      if (existing) {
        return sendError(res, "Email already registered", 409);
      }
    }

    const updates = {
      name: normalizedName || undefined,
      email: email?.trim().toLowerCase() || undefined,
      phoneCountryCode: phoneCountryCode || undefined,
      phoneNumber: normalizedPhone || undefined,
      company: company || undefined,
      avatarUrl: avatarUrl || undefined,
      preferences: preferences || undefined,
    };

    Object.keys(updates).forEach((key) => updates[key] === undefined && delete updates[key]);

    const user = await User.findByIdAndUpdate(req.user.id, updates, { new: true });
    if (!user) {
      return sendError(res, "User not found", 404);
    }

    return sendSuccess(res, {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      phoneCountryCode: user.phoneCountryCode || "",
      phoneNumber: user.phoneNumber || "",
      company: user.company || "",
      avatarUrl: user.avatarUrl || "",
      preferences: user.preferences || {},
    }, "Profile updated");
  } catch (error) {
    return sendError(res, "Failed to update profile", 500);
  }
});

router.put("/password", async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return sendError(res, "Current and new password are required", 400);
    }
    if (newPassword.length < 8) {
      return sendError(res, "New password must be at least 8 characters", 400);
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return sendError(res, "User not found", 404);
    }

    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) {
      return sendError(res, "Current password is incorrect", 401);
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    return sendSuccess(res, { updated: true }, "Password updated");
  } catch (error) {
    return sendError(res, "Failed to update password", 500);
  }
});

export default router;
