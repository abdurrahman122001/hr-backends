// backend/src/index.js
require("dotenv").config();

const express      = require("express");
const http         = require("http");
const mongoose     = require("mongoose");
const cors         = require("cors");
const cron         = require("node-cron");

// Route imports
const authRouter             = require("./routes/auth");
const hrAuthRoutes           = require("./routes/hrAuth");
const employeeCompleteRouter = require("./routes/employeeComplete");
const shiftsRouter           = require("./routes/shift");
const employeesRouter        = require("./routes/employees");
const attendanceRouter       = require("./routes/attendance");
const leavesRouter           = require("./routes/leaves");
const settingsRouter         = require("./routes/settings");
const staffRouter            = require("./routes/staff");
const salarySlipsRouter      = require("./routes/salarySlips");
const attendanceConfigRouter = require("./routes/attendanceConfig");
const offerLetterRoutes      = require("./routes/offerLetterRoutes");
const employeeSalaryRoutes = require('./routes/employeeSalary');

// Controller imports
const hierarchyController = require("./controllers/hierarchyController");

// Middleware
const requireAuth = require("./middleware/auth");

// Model imports
const Employee   = require("./models/Employees");
const Attendance = require("./models/Attendance");

// IMAP watcher
const { startWatcher } = require("./watcher");

const app    = express();
// Wrap express in an HTTP server for Socket-IO
const server = http.createServer(app);

// Initialize Socket-IO
const { Server } = require("socket.io");
const io = new Server(server, { cors: { origin: "*" } });

// Make `io` available on `req.app` in case you ever want to emit from inside routes
app.set("io", io);

// === Middleware ===
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// === Public routes ===
app.use("/api/auth", authRouter);

// === Protected routes ===
app.use("/api/employees",       requireAuth, employeesRouter);
app.use("/api/attendance",      requireAuth, attendanceRouter);
app.use("/api/leaves",          requireAuth, leavesRouter);
app.use("/api/settings",        requireAuth, settingsRouter);
app.use("/api/staff",           requireAuth, staffRouter);
app.use("/api/salary-slips",    requireAuth, salarySlipsRouter);
app.use("/api/shifts",          requireAuth, shiftsRouter);
app.use("/api/offer-letter",    requireAuth, offerLetterRoutes);
app.use("/api/attendance-config", requireAuth, attendanceConfigRouter);
app.use("/api/hr",              hrAuthRoutes);
app.use("/api/employee",        employeeCompleteRouter);
app.use("/api/company-profile", require("./routes/companyProfile"));
app.use('/api/employee-salary', employeeSalaryRoutes);
app.post(
  "/api/hierarchy/create",
  requireAuth,
  hierarchyController.create
);
app.post(
  "/api/hierarchy/bulkCreate",
  requireAuth,
  hierarchyController.bulkCreate
);
app.get(
  "/api/hierarchy",
  requireAuth,
  hierarchyController.getHierarchy
);
app.get(
  "/api/hierarchy/directReports/:employeeId",
  requireAuth,
  hierarchyController.getDirectReports
);
app.get(
  "/api/hierarchy/managementChain/:employeeId",
  requireAuth,
  hierarchyController.getManagementChain
);

// === Employee count endpoint ===
// NOTE: This is NOT protected!
app.get('/api/employees/count', async (req, res) => {
  try {
    const count = await Employee.countDocuments();
    res.json({ count });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get employee count' });
  }
});

// === Socket-IO connection logging ===
io.on("connection", (socket) => {
  console.log("🟢 Socket client connected:", socket.id);
  socket.on("disconnect", () => console.log("🔴 Socket client disconnected:", socket.id));
});

// === Watch Employee collection for inserts ===
Employee.watch().on("change", (change) => {
  // 1) New document inserted
  if (change.operationType === "insert") {
    const emp = change.fullDocument;
    io.emit("employee_added", {
      message:   `New employee added: ${emp.name}`,
      createdAt: emp.createdAt,
    });
  }

  // 2) Existing document updated
  if (change.operationType === "update") {
    const updatedFields = change.updateDescription.updatedFields;
    // a) CNIC field was set or changed
    if ("cnic" in updatedFields) {
      const newCnic = updatedFields.cnic;
      // You can fetch the full doc if you need other fields:
      Employee.findById(change.documentKey._id)
        .lean()
        .then((emp) => {
          io.emit("employee_cnic_updated", {
            message: `CNIC for ${emp.name} updated to ${newCnic}`,
            createdAt: new Date().toISOString(),
          });
        })
        .catch(console.error);
    }
  }
});

// === MongoDB connection ===
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser:    true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("▶ MongoDB connected");
    // Start IMAP watcher once DB is up
    startWatcher();
  })
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// === Cron job: auto-fill yesterday’s attendance ===
cron.schedule(
  "0 0 * * *",
  async () => {
    try {
      console.log("[cron] Auto-filling absent attendance for yesterday");
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const y = yesterday.getFullYear();
      const m = String(yesterday.getMonth() + 1).padStart(2, "0");
      const d = String(yesterday.getDate()).padStart(2, "0");
      const date = `${y}-${m}-${d}`;

      // Identify who already has records
      const done = await Attendance.find({ date }).select("employee").lean();
      const doneIds = new Set(done.map((r) => r.employee.toString()));

      // Get all employees
      const allEmps = await Employee.find({}).select("_id owner").lean();

      // Build upsert operations for those missing
      const ops = allEmps
        .filter((e) => !doneIds.has(e._id.toString()))
        .map((e) => ({
          updateOne: {
            filter: { employee: e._id, date },
            update: {
              $setOnInsert: {
                employee:     e._id,
                date,
                owner:        e.owner,
                status:       "Absent",
                checkIn:      null,
                checkOut:     null,
                notes:        null,
                markedByHR:   false,
              },
            },
            upsert: true,
          },
        }));

      if (ops.length) {
        const res = await Attendance.bulkWrite(ops);
        console.log(`[cron] Upserted ${res.upsertedCount} records for ${date}`);
      } else {
        console.log(`[cron] All employees have attendance for ${date}`);
      }
    } catch (err) {
      console.error("[cron] Error auto-filling attendance:", err);
    }
  },
  { timezone: "UTC" }
);

// === Start the server (with Socket-IO) ===
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`▶ API + Socket.IO listening on port ${PORT}`);
});
