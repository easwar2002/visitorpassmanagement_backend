const mongoose = require('mongoose');

// Status lifecycle:
// pending -> approved -> checked-in -> checked-out
//         -> rejected
// pending/approved -> cancelled
const STATUSES = [
  'pending',
  'approved',
  'rejected',
  'checked-in',
  'checked-out',
  'cancelled',
];

const visitSchema = new mongoose.Schema(
  {
    visitor: { type: mongoose.Schema.Types.ObjectId, ref: 'Visitor', required: true },
    employeeToVisit: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    purpose: { type: String, required: true, trim: true },

    visitDate: { type: Date, required: true }, // date-only (midnight, local calendar date)
    expectedArrivalTime: { type: String, required: true }, // "HH:mm" 24h

    status: { type: String, enum: STATUSES, default: 'pending' },

    remarks: { type: String, trim: true, default: '' }, // employee remarks on approve/reject

    checkInTime: { type: Date, default: null },
    checkOutTime: { type: Date, default: null },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // receptionist
    approvedRejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    checkedInBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    checkedOutBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

visitSchema.index({ visitor: 1, visitDate: 1 });
visitSchema.index({ employeeToVisit: 1, status: 1 });
visitSchema.index({ status: 1 });

module.exports = mongoose.model('Visit', visitSchema);
module.exports.STATUSES = STATUSES;
