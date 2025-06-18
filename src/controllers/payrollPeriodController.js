// src/controllers/payrollPeriodController.js

const PayrollPeriod = require('../models/PayrollPeriod');

// Create a new payroll period
exports.createPayrollPeriod = async (req, res) => {
  const { payrollPeriodType, payrollPeriodStartDay, payrollPeriodLength } = req.body;

  // Duplicate check
  let exists = null;
  if (payrollPeriodType === 'custom') {
    exists = await PayrollPeriod.findOne({
      owner: req.user._id,
      payrollPeriodType,
      payrollPeriodStartDay,
      payrollPeriodLength,
    });
  } else {
    exists = await PayrollPeriod.findOne({
      owner: req.user._id,
      payrollPeriodType,
      payrollPeriodStartDay,
    });
  }
  if (exists) {
    return res.status(409).json({ error: 'Payroll period already exists for this type and start date.' });
  }

  // Create if not duplicate
  const period = await PayrollPeriod.create({
    owner: req.user._id,
    payrollPeriodType,
    payrollPeriodStartDay,
    payrollPeriodLength,
  });
  res.status(201).json(period);
};


exports.getPayrollPeriod = async (req, res, next) => {
  const periods = await PayrollPeriod.find({ owner: req.user._id }).sort({ createdAt: -1 }).lean();
  res.json(periods); // Always an array!
};

exports.updatePayrollPeriod = async (req, res, next) => {
  const {
    payrollPeriodType,
    payrollPeriodStartDay,
    payrollPeriodLength // Only for custom
  } = req.body;

  const updateData = {
    payrollPeriodType
  };

  if (payrollPeriodStartDay) {
    updateData.payrollPeriodStartDay = payrollPeriodStartDay; // <-- This line!
  }

  if (payrollPeriodType === 'custom') {
    if (!payrollPeriodLength || !payrollPeriodStartDay) {
      return res.status(400).json({ error: 'For custom, provide both start day and length' });
    }
    updateData.payrollPeriodLength = payrollPeriodLength;
  } else {
    updateData.payrollPeriodLength = undefined; // Remove for non-custom
  }

  const s = await PayrollPeriod.findOneAndUpdate(
    { owner: req.user._id },
    updateData,
    { upsert: true, new: true }
  ).lean();

  res.json({
    payrollPeriodType: s.payrollPeriodType,
    payrollPeriodStartDay: s.payrollPeriodStartDay, // <-- This will be "YYYY-MM-DD"
    payrollPeriodLength: s.payrollPeriodLength
  });
};
