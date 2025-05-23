// src/models/Setings.js 

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
    enum: ['weekly','10days','bimonthly','monthly'],
    default: 'monthly'
  },
  payrollPeriodStartDay: {
    type: Number,
    default: 1
  }

}, {
  timestamps: true,
});

module.exports = model('Settings', SettingsSchema);
