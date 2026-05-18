import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { isValidEmail, isValidName, normalizeName } from "../utils/validation.js";
import { sendError, sendSuccess } from "../utils/response.js";

const router = express.Router();

const createToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role, name: user.name, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};

router.post("/signup", async (req, res) => {
  try {
    const rawName = req.body.name || "";
    const name = normalizeName(rawName);
    const email = req.body.email?.trim().toLowerCase();
    const password = req.body.password?.trim();
    if (!name || !email || !password) {
      return sendError(res, "All fields are required", 400);
    }
    if (!isValidEmail(email)) {
      return sendError(res, "Invalid email", 400);
    }
    if (!isValidName(rawName)) {
      return sendError(res, "Name can contain only letters and spaces", 400);
    }
    const existing = await User.findOne({ email });
    if (existing) {
      return sendError(res, "Email already registered", 409);
    }
    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email,
      password: hashed,
      status: "active",
      isDeleted: false,
    });
    await User.updateMany(
      { role: "admin", isDeleted: { $ne: true } },
      {
        $push: {
          notifications: {
            title: "New customer signup",
            message: `${user.name} created a new customer account.`,
            type: "system",
          },
        },
      }
    );
    const token = createToken(user);
    return sendSuccess(
      res,
      { token, role: user.role, name: user.name, email: user.email },
      "Signup successful",
      201
    );
  } catch (error) {
    return sendError(res, "Signup failed", 500);
  }
});

router.post("/login", async (req, res) => {
  try {
    const email = req.body.email?.trim().toLowerCase();
    const password = req.body.password?.trim();
    if (!email || !password) {
      return sendError(res, "Email and password are required", 400);
    }
    if (!isValidEmail(email)) {
      return sendError(res, "Invalid email", 400);
    }
    const user = await User.findOne({ email, isDeleted: { $ne: true } });
    if (!user || user.isDeleted) {
      return sendError(res, "Invalid credentials", 401);
    }
    if (user.status === "inactive") {
      return sendError(res, "Account is inactive", 403);
    }
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return sendError(res, "Invalid credentials", 401);
    }
    const token = createToken(user);
    return sendSuccess(res, { token, role: user.role, name: user.name, email: user.email }, "Login successful");
  } catch (error) {
    return sendError(res, "Login failed", 500);
  }
});

export default router;
