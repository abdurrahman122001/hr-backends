const Settings = require('../models/Settings');

exports.getSettings = async (req,res,next) => {
  const s = await Settings.findOne({ owner:req.user._id }).lean();
  if (!s) {
    return res.json({
      timezone:'UTC', useSystemTimezone:true,
      payrollPeriodType:'monthly', payrollPeriodStartDay:1
    });
  }
  res.json({
    timezone: s.timezone,
    useSystemTimezone: s.useSystemTimezone,
    payrollPeriodType: s.payrollPeriodType,
    payrollPeriodStartDay: s.payrollPeriodStartDay
  });
};

exports.updateSettings = async (req,res,next) => {
  const { timezone, useSystemTimezone, payrollPeriodType, payrollPeriodStartDay } = req.body;
  const s = await Settings.findOneAndUpdate(
    { owner: req.user._id },
    { timezone, useSystemTimezone, payrollPeriodType, payrollPeriodStartDay },
    { upsert:true, new:true }
  ).lean();
  res.json({
    timezone: s.timezone,
    useSystemTimezone: s.useSystemTimezone,
    payrollPeriodType: s.payrollPeriodType,
    payrollPeriodStartDay: s.payrollPeriodStartDay
  });
};