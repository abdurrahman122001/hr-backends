// backend/src/index.js
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const cron = require("node-cron");

const hrAuthRoutes = require("./routes/hrAuth");
const offerLetterRouter = require("./routes/offerLetter");
const employeeCompleteRouter = require("./routes/employeeComplete");

// Auth middleware
const requireAuth = require("./middleware/auth");

// Controllers
const hierarchyController = require("./controllers/hierarchyController");

// Routers
const shiftsRouter = require("./routes/shift");
const employeesRouter = require("./routes/employees");
const attendanceRouter = require("./routes/attendance");
const leavesRouter = require("./routes/leaves");
const settingsRouter = require("./routes/settings");
const staffRouter = require("./routes/staff");
const salarySlipsRouter = require("./routes/salarySlips");
const authRouter = require("./routes/auth");
const attendanceConfigRouter = require("./routes/attendanceConfig");

// Models (for cron job)
const Employee = require("./models/Employees");
const Attendance = require("./models/Attendance");

// IMAP watcher
const { startWatcher } = require("./watcher");

const app = express();

// === Middleware ===
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// === Public routes ===
app.use("/api/auth", authRouter);

// === Protected routes ===
app.use("/api/employees", requireAuth, employeesRouter);
app.use("/api/attendance", requireAuth, attendanceRouter);
app.use("/api/leaves", requireAuth, leavesRouter);
app.use("/api/settings", requireAuth, settingsRouter);
app.use("/api/staff", requireAuth, staffRouter);
app.use("/api/salary-slips", requireAuth, salarySlipsRouter);
app.use("/api/shifts", requireAuth, shiftsRouter);
app.use("/api/offer-letter", offerLetterRouter); // offerLetter endpoints are public/auth-checked as needed
app.use("/api/attendance-config", requireAuth, attendanceConfigRouter);
app.use("/api/hr", hrAuthRoutes);
app.use("/api/employee", employeeCompleteRouter);
// === Hierarchy endpoints ===
// Single-create
app.post(
  "/api/hierarchy/create",
  requireAuth,
  hierarchyController.create
);
// Bulk-create
app.post(
  "/api/hierarchy/bulkCreate",
  requireAuth,
  hierarchyController.bulkCreate
);
// Fetch full hierarchy
app.get(
  "/api/hierarchy",
  requireAuth,
  hierarchyController.getHierarchy
);
// Direct reports
app.get(
  "/api/hierarchy/directReports/:employeeId",
  requireAuth,
  hierarchyController.getDirectReports
);
// Management chain
app.get(
  "/api/hierarchy/managementChain/:employeeId",
  requireAuth,
  hierarchyController.getManagementChain
);

// === MongoDB connection ===
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("▶ MongoDB connected");
    // Start IMAP watcher after DB connection
    startWatcher();
  })
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// === Cron job: auto-fill absent attendance ===
cron.schedule(
  "0 0 * * *",
  async () => {
    try {
      console.log("[cron] … auto-fill pending attendance");
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const y = yesterday.getFullYear();
      const m = String(yesterday.getMonth() + 1).padStart(2, "0");
      const d = String(yesterday.getDate()).padStart(2, "0");
      const date = `${y}-${m}-${d}`;

      // Fetch owner-specific configs if needed
      const configsByOwner = {}; // assume loaded elsewhere if you have per-owner settings

      // Who already has records?
      const done = await Attendance.find({ date }).select("employee").lean();
      const doneIds = new Set(done.map((r) => r.employee.toString()));

      // All employees
      const allEmps = await Employee.find({}).select("_id owner").lean();

      const ops = allEmps
        .filter((e) => {
          if (doneIds.has(e._id.toString())) return false;
          const cfg = configsByOwner[e._id.toString()];
          return !cfg || !cfg.markAbsentManually;
        })
        .map((e) => ({
          updateOne: {
            filter: { employee: e._id, date },
            update: {
              $setOnInsert: {
                employee: e._id,
                date,
                owner: e.owner,
                status: "Absent",
                checkIn: null,
                checkOut: null,
                notes: null,
                markedByHR: false,
              },
            },
            upsert: true,
          },
        }));

      if (ops.length) {
        const res = await Attendance.bulkWrite(ops);
        console.log(
          `[cron] inserted ${res.upsertedCount} pending records for ${date}`
        );
      } else {
        console.log(`[cron] all employees already have attendance for ${date}`);
      }
    } catch (err) {
      console.error("[cron] error auto-filling pending:", err);
    }
  },
  { timezone: "UTC" }
);

// === Start server ===
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`▶ API listening on port ${PORT}`));
