const Visit = require('../models/Visit');
const Visitor = require('../models/Visitor');
const Employee = require('../models/Employee');
const ActivityLog = require('../models/ActivityLog');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { startOfDay, isBeforeToday, isTimeBeforeNow, isSameCalendarDate } = require('../utils/dateUtils');

// Visit statuses that count as "still open" for a visitor (Rule 1).
const ACTIVE_STATUSES = ['pending', 'approved', 'checked-in'];

const logActivity = (visitId, action, performedBy, remarks = '') =>
  ActivityLog.create({ visit: visitId, action, performedBy, remarks });

// ---------------------------------------------------------------------------
// POST /api/visits  (receptionist) - Register a visitor + create visit request
// ---------------------------------------------------------------------------
const registerVisit = asyncHandler(async (req, res) => {
  const {
    visitor: visitorInput, // { name, phone, email, company, idProofType, idProofNumber }
    employeeToVisit,
    purpose,
    visitDate,
    expectedArrivalTime,
  } = req.body;

  if (!visitorInput || !visitorInput.name || !visitorInput.phone) {
    throw new AppError('Visitor name and phone number are required.', 400);
  }
  if (!employeeToVisit || !purpose || !visitDate || !expectedArrivalTime) {
    throw new AppError(
      'employeeToVisit, purpose, visitDate and expectedArrivalTime are required.',
      400
    );
  }

  const employee = await Employee.findById(employeeToVisit);
  if (!employee || !employee.isActive) {
    throw new AppError('Selected employee not found or inactive.', 404);
  }

  // ---- Rule 3: visit date cannot be earlier than today ----
  if (isBeforeToday(visitDate)) {
    throw new AppError('Visit date cannot be earlier than the current date.', 400);
  }

  // ---- Rule 4: for today's registrations, arrival time cannot be earlier than now ----
  if (isSameCalendarDate(visitDate, new Date()) && isTimeBeforeNow(expectedArrivalTime)) {
    throw new AppError('Expected arrival time cannot be earlier than the current time.', 400);
  }

  // Find or create the Visitor directory entry, keyed by phone number.
  let visitor = await Visitor.findOne({ phone: visitorInput.phone.trim() });
  if (!visitor) {
    visitor = await Visitor.create({
      name: visitorInput.name,
      phone: visitorInput.phone.trim(),
      email: visitorInput.email,
      company: visitorInput.company,
      idProofType: visitorInput.idProofType,
      idProofNumber: visitorInput.idProofNumber,
    });
  }

  // ---- Rule 1: visitor cannot have more than one active visit at the same time ----
  const activeVisit = await Visit.findOne({
    visitor: visitor._id,
    status: { $in: ACTIVE_STATUSES },
  });
  if (activeVisit) {
    throw new AppError(
      'This visitor already has an active visit (pending, approved, or checked-in). ' +
        'They must be checked out, rejected, or the request cancelled before a new one can be created.',
      409
    );
  }

  // ---- Rule 2: duplicate registration for the same visitor on the same date ----
  const dayStart = startOfDay(visitDate);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const duplicate = await Visit.findOne({
    visitor: visitor._id,
    visitDate: { $gte: dayStart, $lt: dayEnd },
    status: { $nin: ['rejected', 'cancelled'] },
  });
  if (duplicate) {
    throw new AppError('A visit request for this visitor already exists on the selected date.', 409);
  }

  // ---- Rule 5: employee cannot have more than 3 pending requests ----
  const pendingCount = await Visit.countDocuments({
    employeeToVisit: employee._id,
    status: 'pending',
  });
  if (pendingCount >= 3) {
    throw new AppError(
      'This employee already has 3 pending visitor requests awaiting approval. ' +
        'Please try again once one is resolved.',
      409
    );
  }

  const visit = await Visit.create({
    visitor: visitor._id,
    employeeToVisit: employee._id,
    purpose,
    visitDate: dayStart,
    expectedArrivalTime,
    status: 'pending',
    createdBy: req.user._id,
  });

  await logActivity(visit._id, 'Created', req.user._id);

  const populated = await Visit.findById(visit._id)
    .populate('visitor')
    .populate('employeeToVisit', 'name email department designation')
    .populate('createdBy', 'name role');

  res.status(201).json(populated);
});

// ---------------------------------------------------------------------------
// GET /api/visits  - search & filter (role-scoped)
// ---------------------------------------------------------------------------
const getVisits = asyncHandler(async (req, res) => {
  const { visitorName, employeeName, visitDate, status, activeOnly } = req.query;
  const filter = {};

  if (visitorName) {
    const visitorIds = await Visitor.find({
      $or: [
        { name: { $regex: visitorName, $options: 'i' } },
        { phone: { $regex: visitorName, $options: 'i' } },
      ],
    }).distinct('_id');
    filter.visitor = { $in: visitorIds };
  }

  if (employeeName) {
    const employeeIds = await Employee.find({
      name: { $regex: employeeName, $options: 'i' },
    }).distinct('_id');
    filter.employeeToVisit = { $in: employeeIds };
  }

  if (visitDate) {
    const dayStart = startOfDay(visitDate);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    filter.visitDate = { $gte: dayStart, $lt: dayEnd };
  }

  if (status) {
    filter.status = status;
  }

  // ---- Rule 10: cancelled visits excluded from "active" lists ----
  if (activeOnly === 'true') {
    filter.status = filter.status
      ? filter.status
      : { $nin: ['cancelled'] };
  }

  // Role scoping: employees only ever see requests directed at them.
  if (req.user.role === 'employee') {
    if (!req.user.employee) {
      return res.json([]); // employee account not linked to a directory record
    }
    filter.employeeToVisit = req.user.employee;
  }

  const visits = await Visit.find(filter)
    .populate('visitor')
    .populate('employeeToVisit', 'name email department designation')
    .populate('createdBy', 'name role')
    .populate('approvedRejectedBy', 'name role')
    .populate('checkedInBy', 'name role')
    .populate('checkedOutBy', 'name role')
    .sort({ visitDate: -1, createdAt: -1 })
    .limit(500);

  res.json(visits);
});

// ---------------------------------------------------------------------------
// GET /api/visits/:id
// ---------------------------------------------------------------------------
const getVisit = asyncHandler(async (req, res) => {
  const visit = await Visit.findById(req.params.id)
    .populate('visitor')
    .populate('employeeToVisit', 'name email department designation')
    .populate('createdBy', 'name role')
    .populate('approvedRejectedBy', 'name role')
    .populate('checkedInBy', 'name role')
    .populate('checkedOutBy', 'name role');

  if (!visit) throw new AppError('Visit not found.', 404);

  if (
    req.user.role === 'employee' &&
    (!req.user.employee || String(visit.employeeToVisit._id) !== String(req.user.employee))
  ) {
    throw new AppError('You are not authorized to view this visit request.', 403);
  }

  const activity = await ActivityLog.find({ visit: visit._id })
    .populate('performedBy', 'name role')
    .sort({ timestamp: 1 });

  res.json({ visit, activity });
});

// ---------------------------------------------------------------------------
// PUT /api/visits/:id/approve  (employee, own requests only)
// ---------------------------------------------------------------------------
const approveVisit = asyncHandler(async (req, res) => {
  const visit = await Visit.findById(req.params.id);
  if (!visit) throw new AppError('Visit not found.', 404);

  if (!req.user.employee || String(visit.employeeToVisit) !== String(req.user.employee)) {
    throw new AppError('You can only approve requests directed to you.', 403);
  }
  if (visit.status !== 'pending') {
    throw new AppError(`Only pending requests can be approved. Current status: ${visit.status}.`, 400);
  }

  visit.status = 'approved';
  visit.approvedRejectedBy = req.user._id;
  if (req.body.remarks) visit.remarks = req.body.remarks;
  await visit.save();

  await logActivity(visit._id, 'Approved', req.user._id, req.body.remarks || '');

  res.json(visit);
});

// ---------------------------------------------------------------------------
// PUT /api/visits/:id/reject  (employee, own requests only)
// ---------------------------------------------------------------------------
const rejectVisit = asyncHandler(async (req, res) => {
  const visit = await Visit.findById(req.params.id);
  if (!visit) throw new AppError('Visit not found.', 404);

  if (!req.user.employee || String(visit.employeeToVisit) !== String(req.user.employee)) {
    throw new AppError('You can only reject requests directed to you.', 403);
  }
  if (visit.status !== 'pending') {
    throw new AppError(`Only pending requests can be rejected. Current status: ${visit.status}.`, 400);
  }

  visit.status = 'rejected';
  visit.approvedRejectedBy = req.user._id;
  if (req.body.remarks) visit.remarks = req.body.remarks;
  await visit.save();

  await logActivity(visit._id, 'Rejected', req.user._id, req.body.remarks || '');

  res.json(visit);
});

// ---------------------------------------------------------------------------
// PUT /api/visits/:id/checkin  (receptionist)
// ---------------------------------------------------------------------------
const checkInVisit = asyncHandler(async (req, res) => {
  const visit = await Visit.findById(req.params.id);
  if (!visit) throw new AppError('Visit not found.', 404);

  // ---- Rule 6 & Rule 9: only approved requests may be checked in
  //      (this also inherently blocks rejected requests) ----
  // ---- Rule 7: a visitor already checked in cannot be checked in again ----
  //      (status would be 'checked-in', not 'approved', so this is enforced
  //      by the same status check) ----
  if (visit.status !== 'approved') {
    throw new AppError(
      `Only approved requests can be checked in. Current status: ${visit.status}.`,
      400
    );
  }

  visit.status = 'checked-in';
  visit.checkInTime = new Date();
  visit.checkedInBy = req.user._id;
  await visit.save();

  await logActivity(visit._id, 'Checked In', req.user._id);

  res.json(visit);
});

// ---------------------------------------------------------------------------
// PUT /api/visits/:id/checkout  (receptionist)
// ---------------------------------------------------------------------------
const checkOutVisit = asyncHandler(async (req, res) => {
  const visit = await Visit.findById(req.params.id);
  if (!visit) throw new AppError('Visit not found.', 404);

  if (visit.status !== 'checked-in') {
    throw new AppError(
      `Only checked-in visitors can be checked out. Current status: ${visit.status}.`,
      400
    );
  }

  const checkOutTime = new Date();

  // ---- Rule 8: check-out time must always be later than check-in time ----
  if (checkOutTime.getTime() <= visit.checkInTime.getTime()) {
    throw new AppError('Check-out time must be later than check-in time.', 400);
  }

  visit.status = 'checked-out';
  visit.checkOutTime = checkOutTime;
  visit.checkedOutBy = req.user._id;
  await visit.save();

  await logActivity(visit._id, 'Checked Out', req.user._id);

  res.json(visit);
});

// ---------------------------------------------------------------------------
// PUT /api/visits/:id/cancel  (receptionist or admin)
// ---------------------------------------------------------------------------
const cancelVisit = asyncHandler(async (req, res) => {
  const visit = await Visit.findById(req.params.id);
  if (!visit) throw new AppError('Visit not found.', 404);

  if (!['pending', 'approved'].includes(visit.status)) {
    throw new AppError(
      `Only pending or approved requests can be cancelled. Current status: ${visit.status}.`,
      400
    );
  }

  visit.status = 'cancelled';
  visit.cancelledBy = req.user._id;
  await visit.save();

  await logActivity(visit._id, 'Cancelled', req.user._id, req.body.remarks || '');

  res.json(visit);
});

module.exports = {
  registerVisit,
  getVisits,
  getVisit,
  approveVisit,
  rejectVisit,
  checkInVisit,
  checkOutVisit,
  cancelVisit,
};
