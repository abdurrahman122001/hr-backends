// src/controllers/settingsController.js

const Settings = require('../models/Settings');

exports.getSettings = async (req, res) => {
  const s = await Settings.findOne({ owner: req.user._id }).lean();
  res.json({
    timezone: s?.timezone || 'UTC',
    useSystemTimezone: s?.useSystemTimezone ?? true,
  });
};

exports.updateSettings = async (req, res) => {
  const { timezone, useSystemTimezone } = req.body;
  const s = await Settings.findOneAndUpdate(
    { owner: req.user._id },
    { timezone, useSystemTimezone },
    { upsert: true, new: true }
  ).lean();
  res.json({
    timezone: s.timezone,
    useSystemTimezone: s.useSystemTimezone,
  });
};
