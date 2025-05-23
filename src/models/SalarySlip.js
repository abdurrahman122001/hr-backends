// // src/models/SalarySlip.js
// const { Schema, model } = require('mongoose');

// const SalarySlipSchema = new Schema({
//   employee:       { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
//   generatedOn:    { type: Date, default: Date.now },

//   // — Allowances —
//   basic:               { type: Number, default: 0 },
//   cola:                { type: Number, default: 0 },
//   houseRent:           { type: Number, default: 0 },
//   utility:             { type: Number, default: 0 },
//   performanceAllowance:{ type: Number, default: 0 },
//   overtime:            { type: Number, default: 0 },
//   leaveEncashment:     { type: Number, default: 0 },
//   otherAllowances:     { type: Number, default: 0 },

//   totalAllowances:     { type: Number, default: 0 },

//   // — Deductions —
//   absenteeDeduction:   { type: Number, default: 0 },
//   fuelMaintenance:     { type: Number, default: 0 },
//   pfDeduction:         { type: Number, default: 0 },
//   otherDeductions:     { type: Number, default: 0 },

//   totalDeductions:     { type: Number, default: 0 },

//   // — Net Pay —
//   netPayable:          { type: Number, default: 0 },

//   // — Single leave entitlement field (no breakdown) —
//   leaveEntitlement:    { type: Number, required: true },

//   // — Loan details (if you still need them) —
//   loanPrincipal:       { type: Number, default: 0 },
//   loanProfit:          { type: Number, default: 0 },
//   loanWithdrawal:      { type: Number, default: 0 },
//   loanBalance:         { type: Number, default: 0 },

// }, { timestamps: true });

// // Recompute totals on save
// SalarySlipSchema.pre('save', function(next) {
//   this.totalAllowances = [
//     this.basic, this.cola, this.houseRent, this.utility,
//     this.performanceAllowance, this.overtime,
//     this.leaveEncashment, this.otherAllowances
//   ].reduce((a, b) => a + b, 0);

//   this.totalDeductions = [
//     this.absenteeDeduction, this.fuelMaintenance,
//     this.pfDeduction, this.otherDeductions
//   ].reduce((a, b) => a + b, 0);

//   this.netPayable = this.totalAllowances - this.totalDeductions;
//   next();
// });

// module.exports = model('SalarySlip', SalarySlipSchema);
// backend/src/models/SalarySlip.js
const { Schema, model } = require('mongoose');

const SalarySlipSchema = new Schema({
  employee:                { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
  generatedOn:             { type: Date, default: Date.now },

  // Allowances
  basic:                   { type: Number, default: 0 },
  dearnessAllowance:       { type: Number, default: 0 },
  houseRentAllowance:      { type: Number, default: 0 },
  conveyanceAllowance:     { type: Number, default: 0 },
  medicalAllowance:        { type: Number, default: 0 },
  utilityAllowance:        { type: Number, default: 0 },
  overtimeCompensation:    { type: Number, default: 0 },
  dislocationAllowance:    { type: Number, default: 0 },
  leaveEncashment:         { type: Number, default: 0 },
  bonus:                   { type: Number, default: 0 },
  arrears:                 { type: Number, default: 0 },
  autoAllowance:           { type: Number, default: 0 },
  incentive:               { type: Number, default: 0 },
  fuelAllowance:           { type: Number, default: 0 },
  othersAllowances:        { type: Number, default: 0 },
  grossSalary:             { type: Number, default: 0 },

  // Deductions
  leaveDeductions:         { type: Number, default: 0 },
  lateDeductions:          { type: Number, default: 0 },
  eobiDeduction:           { type: Number, default: 0 },
  sessiDeduction:          { type: Number, default: 0 },
  providentFundDeduction:  { type: Number, default: 0 },
  gratuityFundDeduction:   { type: Number, default: 0 },
  loanDeductions: {
    vehicleLoan:            { type: Number, default: 0 },
    otherLoans:             { type: Number, default: 0 },
  },
  advanceSalaryDeductions:{ type: Number, default: 0 },
  medicalInsurance:        { type: Number, default: 0 },
  lifeInsurance:           { type: Number, default: 0 },
  penalties:               { type: Number, default: 0 },
  othersDeductions:        { type: Number, default: 0 },
  taxDeduction:            { type: Number, default: 0 },

  totalAllowances:         { type: Number, default: 0 },
  totalDeductions:         { type: Number, default: 0 },
  netPayable:              { type: Number, default: 0 },
}, { timestamps: true });

// Recompute totals before save
SalarySlipSchema.pre('save', function(next) {
  const a = [
    this.basic,
    this.dearnessAllowance,
    this.houseRentAllowance,
    this.conveyanceAllowance,
    this.medicalAllowance,
    this.utilityAllowance,
    this.overtimeCompensation,
    this.dislocationAllowance,
    this.leaveEncashment,
    this.bonus,
    this.arrears,
    this.autoAllowance,
    this.incentive,
    this.fuelAllowance,
    this.othersAllowances,
    this.grossSalary
  ].reduce((sum, v) => sum + v, 0);
  this.totalAllowances = a;

  const d = [
    this.leaveDeductions,
    this.lateDeductions,
    this.eobiDeduction,
    this.sessiDeduction,
    this.providentFundDeduction,
    this.gratuityFundDeduction,
    this.advanceSalaryDeductions,
    this.medicalInsurance,
    this.lifeInsurance,
    this.penalties,
    this.othersDeductions,
    this.taxDeduction
  ].reduce((sum, v) => sum + v, 0);
  this.totalDeductions = d;

  this.netPayable = a - d;
  next();
});

module.exports = model('SalarySlip', SalarySlipSchema);
