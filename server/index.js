import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import morgan from "morgan";
import bcrypt from "bcryptjs";
import connectDb from "./config/db.js";
import authRoutes from "./routes/auth.js";
import ticketRoutes from "./routes/tickets.js";
import employeeRoutes from "./routes/employees.js";
import userRoutes from "./routes/users.js";
import notificationRoutes from "./routes/notifications.js";
import feedbackRoutes from "./routes/feedback.js";
import dashboardRoutes from "./routes/dashboard.js";
import User from "./models/User.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.get("/", (req, res) => {
  res.json({ message: "Freight platform API running" });
});

app.use("/api/auth", authRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/users", userRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/dashboard", dashboardRoutes);

const ensureDefaultUsers = async () => {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const employeeEmail = process.env.EMPLOYEE_EMAIL;
  const employeePassword = process.env.EMPLOYEE_PASSWORD;

  if (adminEmail && adminPassword) {
    const normalizedEmail = adminEmail.toLowerCase();
    const existing = await User.findOne({ email: normalizedEmail });
    if (!existing) {
      const hashed = await bcrypt.hash(adminPassword, 10);
      await User.create({
        name: "Admin",
        email: normalizedEmail,
        password: hashed,
        role: "admin",
        status: "active",
        isDeleted: false,
      });
      console.log("Default admin created");
    } else {
      const passwordMatches = await bcrypt.compare(adminPassword, existing.password);
      if (existing.isDeleted !== false || existing.role !== "admin" || existing.status !== "active" || !passwordMatches) {
        const hashed = await bcrypt.hash(adminPassword, 10);
        await User.updateOne(
          { _id: existing._id },
          {
            name: existing.name || "Admin",
            email: normalizedEmail,
            password: hashed,
            role: "admin",
            status: "active",
            isDeleted: false,
          }
        );
        console.log("Default admin restored");
      }
    }
  }

  if (employeeEmail && employeePassword) {
    const normalizedEmail = employeeEmail.toLowerCase();
    const existing = await User.findOne({ email: normalizedEmail });
    if (!existing) {
      const hashed = await bcrypt.hash(employeePassword, 10);
      await User.create({
        name: "Employee",
        email: normalizedEmail,
        password: hashed,
        role: "employee",
        employeeId: "EMP001",
        department: "Operations",
        roleLevel: "Employee",
        status: "active",
        isDeleted: false,
      });
      console.log("Default employee created");
    } else {
      const passwordMatches = await bcrypt.compare(employeePassword, existing.password);
      if (existing.isDeleted !== false || existing.role !== "employee" || existing.status !== "active" || !passwordMatches) {
        const hashed = await bcrypt.hash(employeePassword, 10);
        await User.updateOne(
          { _id: existing._id },
          {
            name: existing.name || "Employee",
            email: normalizedEmail,
            password: hashed,
            role: "employee",
            employeeId: existing.employeeId || "EMP001",
            department: existing.department || "Operations",
            roleLevel: existing.roleLevel || "Employee",
            status: "active",
            isDeleted: false,
          }
        );
        console.log("Default employee restored");
      }
    }
  }
};

const start = async () => {
  try {
    await connectDb();
    await ensureDefaultUsers();
    const port = process.env.PORT || 4000;
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

start();
