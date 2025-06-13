const Settings = require('../models/Settings');

exports.getSettings = async (req, res, next) => {
  const s = await Settings.findOne({ owner: req.user._id }).lean();
  if (!s) {
    return res.json({
      timezone: 'UTC',
      useSystemTimezone: true,
      payrollPeriodType: 'monthly',
      payrollPeriodStartDay: new Date().toISOString().slice(0, 10),
      payrollPeriodLength: null
    });
  }
  res.json({
    timezone: s.timezone,
    useSystemTimezone: s.useSystemTimezone,
    payrollPeriodType: s.payrollPeriodType,
    payrollPeriodStartDay: s.payrollPeriodStartDay
      ? (typeof s.payrollPeriodStartDay === 'string'
          ? s.payrollPeriodStartDay
          : s.payrollPeriodStartDay.toISOString().slice(0,10))
      : null,
    payrollPeriodLength: s.payrollPeriodType === 'custom'
      ? s.payrollPeriodLength
      : null,
  });
};

exports.updateSettings = async (req, res, next) => {
  const {
    timezone,
    useSystemTimezone,
    payrollPeriodType,
    payrollPeriodStartDay,
    payrollPeriodLength // Only for custom
  } = req.body;

  const updateData = {
    timezone,
    useSystemTimezone,
    payrollPeriodType
  };

  // ✅ DO NOT PARSE TO Date OBJECT! JUST USE THE STRING
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

  const s = await Settings.findOneAndUpdate(
    { owner: req.user._id },
    updateData,
    { upsert: true, new: true }
  ).lean();

  res.json({
    timezone: s.timezone,
    useSystemTimezone: s.useSystemTimezone,
    payrollPeriodType: s.payrollPeriodType,
    payrollPeriodStartDay: s.payrollPeriodStartDay, // <-- This will be "YYYY-MM-DD"
    payrollPeriodLength: s.payrollPeriodLength
  });
};

