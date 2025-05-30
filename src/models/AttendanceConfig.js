const { Schema, model } = require('mongoose');

const AttendanceConfigSchema = new Schema({
  owner: {
    type:     Schema.Types.ObjectId,
    ref:      'User',
    required: true,
    unique:   true
  },
  markAbsentManually: { type: Boolean, default: false },
  allowDeleteRecords: { type: Boolean, default: false },
  allowEditRecords:   { type: Boolean, default: false },
  editRecordsScope: {
    type: String,
    enum: ['current','anytime','previous'],
    default: 'current'
  },
  previousDaysLimit:  { type: Number, default: 7 }
}, {
  timestamps: true
});

module.exports = model('AttendanceConfig', AttendanceConfigSchema);
