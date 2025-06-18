// src/models/PayrollPeriod.js

const { Schema, model } = require('mongoose');

const PayrollPeriodSchema  = new Schema({
  owner: {
    type:     Schema.Types.ObjectId,
    ref:      'User',
    required: true,
  },

  payrollPeriodType: {
    type: String,
    enum: ['daily', 'weekly', '10-days', 'bimonthly', 'monthly', 'custom'],
    default: 'monthly'
  },
  payrollPeriodStartDay: {
    type: String, // ISO date string: 'YYYY-MM-DD'
    default: null
  },
  payrollPeriodLength: { type: Number },
}, {
  timestamps: true,
});

module.exports = model('PayrollPeriod', PayrollPeriodSchema );
