// src/models/Settings.js

const { Schema, model } = require('mongoose');

const SettingsSchema = new Schema({
  owner: {
    type:     Schema.Types.ObjectId,
    ref:      'User',
    required: true,
    unique:   true,
  },
  timezone: {
    type:    String,
    default: 'UTC',
  },
  useSystemTimezone: {
    type:    Boolean,
    default: true,
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

module.exports = model('Settings', SettingsSchema);
