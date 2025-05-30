const AttendanceConfig = require('../models/AttendanceConfig');

const DEFAULT = {
  markAbsentManually: false,
  allowDeleteRecords: false,
  allowEditRecords:   false,
  editRecordsScope:   'current',
  previousDaysLimit:  7
};

exports.getConfig = async (req, res, next) => {
  try {
    let cfg = await AttendanceConfig.findOne({ owner: req.user._id }).lean();
    if (!cfg) {
      // no doc → just return defaults
      return res.json(DEFAULT);
    }
    // merge any missing keys (in case you add new fields later)
    cfg = Object.assign({}, DEFAULT, cfg);
    res.json(cfg);
  } catch (err) {
    next(err);
  }
};

exports.updateConfig = async (req, res, next) => {
  try {
    const {
      markAbsentManually,
      allowDeleteRecords,
      allowEditRecords,
      editRecordsScope,
      previousDaysLimit
    } = req.body;

    const cfg = await AttendanceConfig.findOneAndUpdate(
      { owner: req.user._id },
      {
        owner:              req.user._id,
        markAbsentManually,
        allowDeleteRecords,
        allowEditRecords,
        editRecordsScope,
        previousDaysLimit
      },
      { upsert: true, new: true }
    ).lean();

    res.json(cfg);
  } catch (err) {
    next(err);
  }
};
