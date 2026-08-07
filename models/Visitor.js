const mongoose = require('mongoose');

// Represents a real-world visitor (a person). A single Visitor can have many
// Visit records over time (history), but business rules constrain how many
// active/duplicate Visits they can have at once (see Visit model + controller).
const visitorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true, index: true },
    email: { type: String, trim: true, lowercase: true },
    company: { type: String, trim: true },
    idProofType: {
      type: String,
      enum: ['Aadhar', 'PAN', 'Passport', 'DrivingLicense', 'VoterID', 'Other'],
      default: 'Other',
    },
    idProofNumber: { type: String, trim: true },
  },
  { timestamps: true }
);

// A visitor is uniquely identified by phone number for dedupe / lookup purposes.
visitorSchema.index({ phone: 1 });

module.exports = mongoose.model('Visitor', visitorSchema);
