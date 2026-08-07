const mongoose = require('mongoose');

const ACTIONS = [
  'Created',
  'Approved',
  'Rejected',
  'Checked In',
  'Checked Out',
  'Cancelled',
];

const activityLogSchema = new mongoose.Schema(
  {
    visit: { type: mongoose.Schema.Types.ObjectId, ref: 'Visit', required: true, index: true },
    action: { type: String, enum: ACTIONS, required: true },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    remarks: { type: String, trim: true, default: '' },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

module.exports = mongoose.model('ActivityLog', activityLogSchema);
module.exports.ACTIONS = ACTIONS;
