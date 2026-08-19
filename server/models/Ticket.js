import mongoose from "mongoose";

const quoteSchema = new mongoose.Schema(
  {
    quoteId: { type: String, required: true },
    carrier: { type: String, required: true },
    serviceType: { type: String },
    rate: { type: Number, required: true },
    currency: { type: String, default: "USD" },
    transitTime: { type: String },
    validity: { type: String },
    remarks: { type: String },
    chargeableWeight: { type: Number },
    totalAmount: { type: Number },
    quoteDate: { type: String },
    status: {
      type: String,
      enum: ["pending", "sent", "accepted", "rejected"],
      default: "sent",
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    createdByName: { type: String },
  },
  { timestamps: true }
);

const bookingSchema = new mongoose.Schema(
  {
    bookingId: { type: String, required: true },
    reference: { type: String, required: true },
    notes: { type: String },
    bookedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

const loadSchema = new mongoose.Schema(
  {
    unitCount: { type: Number, required: true },
    weightPerUnit: { type: Number, required: true },
    totalWeight: { type: Number, required: true },
    dimensions: {
      length: { type: Number, required: true },
      width: { type: Number, required: true },
      height: { type: Number, required: true },
      unit: { type: String, enum: ["IN", "CM"], required: true },
    },
    stackable: { type: Boolean, default: false },
    turnable: { type: Boolean, default: false },
    summary: { type: String },
  },
  { _id: false }
);

const ticketSchema = new mongoose.Schema(
  {
    ticketId: { type: String, required: true, unique: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    customerName: { type: String, required: true },
    origin: { type: String, required: true },
    destination: { type: String, required: true },
    cargoType: { type: String, required: true },
    shipperIdStatus: { type: String, enum: ["known", "unknown"], required: true },
    loads: { type: [loadSchema], default: [] },
    loadSummary: { type: [String], default: [] },
    notes: { type: String },
    assignedEmployee: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    assignedEmployeeName: { type: String },
    assignedEmployeeId: { type: String },
    quotes: { type: [quoteSchema], default: [] },
    closedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    closedByName: { type: String },
    closedAt: { type: String },
    bookedOn: { type: String },
    finalRate: { type: Number },
    awbNumber: { type: String },
    screenshotUrl: { type: String },
    closingNotes: { type: String },
    status: {
      type: String,
      enum: ["open", "quoted", "in_transit", "closed"],
      default: "open",
    },
    quote: quoteSchema,
    booking: bookingSchema,
  },
  { timestamps: true }
);

const Ticket = mongoose.model("Ticket", ticketSchema);

export default Ticket;
