import mongoose from "mongoose";
import { isValidName, nameRegex } from "../utils/validation.js";

const feedbackSchema = new mongoose.Schema(
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
    email: { type: String, required: true, trim: true, lowercase: true },
    message: { type: String, required: true, trim: true },
    status: { type: String, enum: ["new", "read"], default: "new" },
  },
  { timestamps: true }
);

const Feedback = mongoose.model("Feedback", feedbackSchema);

export default Feedback;
