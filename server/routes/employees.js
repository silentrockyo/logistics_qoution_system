import express from "express";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import { authGuard, requireRole } from "../middleware/auth.js";
import { isValidEmail, isValidName, isValidPhone, normalizeName, normalizePhone } from "../utils/validation.js";
import { sendError, sendSuccess } from "../utils/response.js";

const router = express.Router();

const generatePassword = () => {
  const seed = Math.random().toString(36).slice(-8);
  return `EMP-${seed}`;
};

const getNextEmployeeId = async () => {
  const lastEmployee = await User.find({ employeeId: { $ne: null } })
    .sort({ employeeId: -1 })
    .limit(1);
  if (!lastEmployee.length) {
    return "EMP001";
  }
  const lastId = lastEmployee[0].employeeId || "EMP000";
  const numeric = Number(lastId.replace(/[^0-9]/g, "")) || 0;
  const next = numeric + 1;
  return `EMP${String(next).padStart(3, "0")}`;
};

router.use(authGuard);
router.use(requireRole("admin"));

router.post("/", async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      phoneCountryCode,
      phoneNumber,
      department,
      roleLevel,
      branch,
      status,
    } = req.body;
    const trimmedName = name ? normalizeName(name) : "";
    const normalizedPhone = phoneNumber ? normalizePhone(phoneNumber) : "";
    const normalizedEmail = email?.trim().toLowerCase();
    if (!trimmedName || !normalizedEmail) {
      return sendError(res, "Name and email are required", 400);
    }
    if (!isValidName(trimmedName)) {
      return sendError(res, "Name can contain only letters and spaces", 400);
    }
    if (!isValidEmail(normalizedEmail)) {
      return sendError(res, "Invalid email", 400);
    }
    if (phoneNumber && !isValidPhone(normalizedPhone)) {
      return sendError(res, "Phone number must be 10 digits", 400);
    }
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return sendError(res, "Email already registered", 409);
    }
    const nextEmployeeId = await getNextEmployeeId();
    const rawPassword = password && password.trim() ? password.trim() : generatePassword();
    const hashed = await bcrypt.hash(rawPassword, 10);
    const employee = await User.create({
      name: trimmedName,
      email: normalizedEmail,
      password: hashed,
      role: "employee",
      phoneCountryCode,
      phoneNumber: normalizedPhone || undefined,
      department,
      roleLevel,
      employeeId: nextEmployeeId,
      branch,
      status: status || "active",
      isDeleted: false,
    });
    const { password: _password, ...safeEmployee } = employee.toObject();
    return sendSuccess(res, { employee: safeEmployee, tempPassword: rawPassword }, "Employee created", 201);
  } catch (error) {
    return sendError(res, "Failed to create employee", 500);
  }
});

router.get("/", async (req, res) => {
  try {
    const { search, department, roleLevel, status } = req.query;
    const filter = { role: "employee", isDeleted: { $ne: true } };
    if (department) {
      filter.department = department;
    }
    if (roleLevel) {
      filter.roleLevel = roleLevel;
    }
    if (status) {
      filter.status = status;
    }
    if (search) {
      const regex = new RegExp(search, "i");
      filter.$or = [
        { name: regex },
        { email: regex },
        { employeeId: regex },
      ];
    }
    const employees = await User.find(filter).select("-password").sort({ createdAt: -1 });
    return sendSuccess(res, { items: employees }, "Employees loaded");
  } catch (error) {
    return sendError(res, "Failed to load employees", 500);
  }
});

router.put("/:id", async (req, res) => {
  try {
    const { name, email, phoneCountryCode, phoneNumber, department, roleLevel, branch, status } = req.body;
    const normalizedEmail = email?.trim().toLowerCase();
    if (normalizedEmail) {
      const existing = await User.findOne({ email: normalizedEmail, _id: { $ne: req.params.id } });
      if (existing) {
        return sendError(res, "Email already registered", 409);
      }
      if (!isValidEmail(normalizedEmail)) {
        return sendError(res, "Invalid email", 400);
      }
    }
    const normalizedName = name ? normalizeName(name) : "";
    const normalizedPhone = phoneNumber ? normalizePhone(phoneNumber) : "";
    if (name != null && !isValidName(normalizedName)) {
      return sendError(res, "Name can contain only letters and spaces", 400);
    }
    if (phoneNumber && !isValidPhone(normalizedPhone)) {
      return sendError(res, "Phone number must be 10 digits", 400);
    }
    const updates = {
      name: normalizedName || undefined,
      email: normalizedEmail || undefined,
      phoneCountryCode: phoneCountryCode || undefined,
      phoneNumber: normalizedPhone || undefined,
      department,
      roleLevel,
      branch,
      status,
    };
    Object.keys(updates).forEach((key) => updates[key] === undefined && delete updates[key]);
    const updated = await User.findOneAndUpdate(
      { _id: req.params.id, role: "employee", isDeleted: { $ne: true } },
      updates,
      { new: true }
    );
    if (!updated) {
      return sendError(res, "Employee not found", 404);
    }
    const { password: _password, ...safeEmployee } = updated.toObject();
    return sendSuccess(res, safeEmployee, "Employee updated");
  } catch (error) {
    return sendError(res, "Failed to update employee", 500);
  }
});

router.patch("/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    if (!status || !["active", "inactive"].includes(status)) {
      return sendError(res, "Invalid status", 400);
    }
    const updated = await User.findOneAndUpdate(
      { _id: req.params.id, role: "employee", isDeleted: { $ne: true } },
      { status },
      { new: true }
    );
    if (!updated) {
      return sendError(res, "Employee not found", 404);
    }
    const { password: _password, ...safeEmployee } = updated.toObject();
    return sendSuccess(res, safeEmployee, "Status updated");
  } catch (error) {
    return sendError(res, "Failed to update status", 500);
  }
});

router.patch("/:id/reset-password", async (req, res) => {
  try {
    const rawPassword = req.body.password && req.body.password.trim()
      ? req.body.password.trim()
      : generatePassword();
    const hashed = await bcrypt.hash(rawPassword, 10);
    const updated = await User.findOneAndUpdate(
      { _id: req.params.id, role: "employee", isDeleted: { $ne: true } },
      { password: hashed },
      { new: true }
    );
    if (!updated) {
      return sendError(res, "Employee not found", 404);
    }
    const { password: _password, ...safeEmployee } = updated.toObject();
    return sendSuccess(res, { employee: safeEmployee, tempPassword: rawPassword }, "Password reset");
  } catch (error) {
    return sendError(res, "Failed to reset password", 500);
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const updated = await User.findOneAndUpdate(
      { _id: req.params.id, role: "employee", isDeleted: { $ne: true } },
      { isDeleted: true, status: "inactive" },
      { new: true }
    );
    if (!updated) {
      return sendError(res, "Employee not found", 404);
    }
    return sendSuccess(res, { deleted: true }, "Employee deleted");
  } catch (error) {
    return sendError(res, "Failed to delete employee", 500);
  }
});

export default router;
