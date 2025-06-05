const mongoose = require("mongoose");
const bcrypt   = require("bcrypt");
const SALT_ROUNDS = 10;

const { Schema, model } = mongoose;

const EmployeeSchema = new Schema(
  {
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true },

    name: { type: String, required: true },

    // CNIC is required and must be a non‐empty string
    cnic: {
      type: String,
      required: [true, "CNIC is required"],
      trim: true,
      validate: {
        validator: (v) => typeof v === "string" && v.trim() !== "",
        message: "CNIC cannot be empty",
      },
    },

    // Email is required and must be a non‐empty string
    email: {
      type: String,
      required: [true, "Email is required"],
      trim: true,
      validate: {
        validator: (v) => typeof v === "string" && v.trim() !== "",
        message: "Email cannot be empty",
      },
    },

    // ──────────────────────────────────────────────────────────────────────
    // Store a hashed password only if this employee is HR.
    password: {
      type: String,
      required: function () {
        return this.isHR; // only required when isHR === true
      },
      minlength: [6, "Password must be at least 6 characters"],
      default: null,
    },
    // ──────────────────────────────────────────────────────────────────────

    fatherOrHusbandName: { type: String },
    photographUrl:       { type: String },
    dateOfBirth:         { type: String },
    gender:              { type: String, enum: ["Male", "Female", "Other"] },
    nationality:         { type: String },
    cnicIssueDate:       { type: Date },
    cnicExpiryDate:      { type: Date },
    maritalStatus:       { type: String, enum: ["Single", "Married"] },
    religion:            { type: String },
    latestQualification: { type: String },
    phone:               { type: String },
    permanentAddress:    { type: String },
    presentAddress:      { type: String },

    bankName:          { type: String },
    bankAccountNumber: { type: String },

    nomineeName:        { type: String },
    nomineeRelation:    { type: String },
    nomineeCnic:        { type: String },
    nomineeEmergencyNo: { type: String },
    rt:                { type: String, default: "15:15" },

    // Employment Details
    department:  { type: String },
    designation: { type: String },
    joiningDate: { type: Date },

    // Leave Entitlement
    leaveEntitlement: {
      total:      { type: Number, default: 22 },
      usedPaid:   { type: Number, default: 0 },
      usedUnpaid: { type: Number, default: 0 },
    },

    // Compensation Details
    compensation: {
      basic:                { type: Number, default: 0 },
      dearnessAllowance:    { type: Number, default: 0 },
      houseRentAllowance:   { type: Number, default: 0 },
      conveyanceAllowance:  { type: Number, default: 0 },
      medicalAllowance:     { type: Number, default: 0 },
      utilityAllowance:     { type: Number, default: 0 },
      overtimeComp:         { type: Number, default: 0 },
      dislocationAllowance: { type: Number, default: 0 },
      leaveEncashment:      { type: Number, default: 0 },
      bonus:                { type: Number, default: 0 },
      arrears:              { type: Number, default: 0 },
      autoAllowance:        { type: Number, default: 0 },
      incentive:            { type: Number, default: 0 },
      fuelAllowance:        { type: Number, default: 0 },
      others:               { type: Number, default: 0 },
      grossSalary:          { type: Number, default: 0 },
    },

    // Deductions
    deductions: {
      leaveDeductions: { type: Number, default: 0 },
      lateDeductions:  { type: Number, default: 0 },
      eobi:            { type: Number, default: 0 },
      sessi:           { type: Number, default: 0 },
      providentFund:   { type: Number, default: 0 },
      gratuityFund:    { type: Number, default: 0 },
      loanDeductions:  {
        vehicleLoan: { type: Number, default: 0 },
        otherLoans:  { type: Number, default: 0 },
      },
      advanceSalary:   { type: Number, default: 0 },
      medicalInsurance:{ type: Number, default: 0 },
      lifeInsurance:   { type: Number, default: 0 },
      penalties:       { type: Number, default: 0 },
      others:          { type: Number, default: 0 },
      tax:             { type: Number, default: 0 },
    },

    // Mark this employee as HR; if true, password is required
    isHR: {
      type: Boolean,
      default: false,
    },

    // Mark this employee as an Admin (queried by HR)
    isAdmin: {
      type: Boolean,
      default: false,
    },

    // Reference to a User document (kept for future use if needed)
    userAccount: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
  },
  {
    timestamps: true,
  }
);

// ─────────────────────────────────────────────────────────────────────────
// Hash password before saving (only if modified or new)
EmployeeSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  try {
    const hashed = await bcrypt.hash(this.password, SALT_ROUNDS);
    this.password = hashed;
    next();
  } catch (err) {
    next(err);
  }
});

// Expose comparePassword method on instances
EmployeeSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

// ─────────────────────────────────────────────────────────────────────────
// Index definitions:
//   1) Unique on (owner + cnic), sparse: only index docs where cnic exists.
//   2) Unique on email, sparse as well.
//─────────────────────────────────────────────────────────────────────────
EmployeeSchema.index(
  { owner: 1, cnic: 1 },
  {
    unique: true,
    sparse: true,
  }
);
EmployeeSchema.index(
  { email: 1 },
  {
    unique: true,
    sparse: true,
  }
);

module.exports = model("Employee", EmployeeSchema);
