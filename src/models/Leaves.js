const { Schema, model } = require('mongoose');
const LeavesSchema = new Schema({
  owner:         { type: Schema.Types.ObjectId, ref: 'User', required: true },
  employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
  date:     { type: String, required: true },
  daysRequested: { type: Number, required: true },
  endDate:       { type: Date, required: true },
  status:   { type: String, enum: ['Pending','Approved','Rejected', 'Withdrawn'], default: 'Pending' },
  requestedAt:   { type: Date, default: () => new Date() },
  approvedAt:    { type: Date }
}, { timestamps: true });

LeavesSchema.index({ employee:1, date:1, endDate: 1  }, { unique: true });

module.exports = model('Leaves', LeavesSchema);