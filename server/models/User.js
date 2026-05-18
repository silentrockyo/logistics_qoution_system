import mongoose from "mongoose";
import { isValidName, nameRegex, phoneRegex } from "../utils/validation.js";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 50,
      match: [nameRegex, "Name can contain only letters and spaces"],
      validate: {
        validator: (value) => isValidName(value),
        message: "Name can contain only letters and spaces",
      },
    },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ["customer", "employee", "admin"],
      default: "customer",
    },
    phoneCountryCode: { type: String, trim: true },
    phoneNumber: {
      type: String,
      trim: true,
      validate: {
        validator: (value) => !value || phoneRegex.test(value),
        message: "Phone number must be 10 digits",
      },
    },
    company: { type: String, trim: true },
    avatarUrl: { type: String, trim: true },
    department: {
      type: String,
      enum: ["Sales", "Pricing", "Operations", "Customer Support", "Management"],
    },
    roleLevel: {
      type: String,
      enum: ["Employee", "Senior Employee", "Team Lead", "Manager"],
    },
    employeeId: { type: String, unique: true, sparse: true },
    branch: { type: String, trim: true },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    isDeleted: { type: Boolean, default: false },
    preferences: {
      theme: { type: String, enum: ["light", "dark"], default: "light" },
      language: { type: String, default: "en" },
      notifications: {
        tenderAssigned: { type: Boolean, default: true },
        quoteSubmitted: { type: Boolean, default: true },
        ticketClosed: { type: Boolean, default: true },
        systemAlerts: { type: Boolean, default: true },
      },
    },
    notifications: [
      {
        title: { type: String, required: true },
        message: { type: String, required: true },
        type: { type: String, default: "system" },
        ticketId: { type: String },
        read: { type: Boolean, default: false },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

export default User;
