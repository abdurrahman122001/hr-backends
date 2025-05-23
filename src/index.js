// backend/src/index.js
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const cron = require("node-cron");
const shiftsRouter = require('./routes/shift');
const Employee = require("./models/Employees");
const Attendance = require("./models/Attendance");
const requireAuth = require("./middleware/auth");  
const salarySlipsRoute = require('./routes/salarySlips');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Public auth routes
app.use("/api/auth", require("./routes/auth"));

// Protected routes
app.use("/api/employees", requireAuth, require("./routes/employees"));
app.use("/api/attendance", requireAuth, require("./routes/attendance"));
app.use("/api/leaves", requireAuth, require("./routes/leaves"));
app.use("/api/settings", requireAuth, require("./routes/settings"));
app.use("/api/staff", requireAuth, require("./routes/staff"));
app.use('/api/salary-slips', requireAuth, salarySlipsRoute);
app.use("/api/shifts", requireAuth, shiftsRouter);
app.use("/api/hierarchy", requireAuth, require("./routes/hierarchy"));
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("▶ MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`▶ API listening on port ${PORT}`));

cron.schedule(
  "0 0 * * *",
  async () => {
    try {
      console.log("[cron] … auto-fill pending attendance");

      // 1) yesterday's date string
      const now = new Date();
      now.setDate(now.getDate() - 1);
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, "0");
      const d = String(now.getDate()).padStart(2, "0");
      const date = `${y}-${m}-${d}`;

      // 2) who already has records for that date?
      const done = await Attendance.find({ date }).select("employee").lean();
      const doneIds = new Set(done.map((r) => r.employee.toString()));

      // 3) grab everybody
      const allEmps = await Employee.find({}).select("_id").lean();

      // 4) bulk upsert missing ones as Absent
      const ops = allEmps
        .filter((e) => !doneIds.has(e._id.toString()))
        .map((e) => ({
          updateOne: {
            filter: { employee: e._id, date },
            update: {
              $setOnInsert: {
                employee: e._id,
                date,
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
  {
    timezone: "UTC",
  }
);
