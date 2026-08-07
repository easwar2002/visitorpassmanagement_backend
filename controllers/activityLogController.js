const ActivityLog = require('../models/ActivityLog');
const Visit = require('../models/Visit');
const Visitor = require('../models/Visitor');
const Employee = require('../models/Employee');
const { asyncHandler } = require('../middleware/errorHandler');
const { startOfDay } = require('../utils/dateUtils');

// GET /api/activity-logs?visitorName=&employeeName=&action=&from=&to=
const getActivityLogs = asyncHandler(async (req, res) => {
  const { visitorName, employeeName, action, from, to } = req.query;

  let visitFilter = {};

  if (visitorName) {
    const visitorIds = await Visitor.find({
      $or: [
        { name: { $regex: visitorName, $options: 'i' } },
        { phone: { $regex: visitorName, $options: 'i' } },
      ],
    }).distinct('_id');
    visitFilter.visitor = { $in: visitorIds };
  }

  if (employeeName) {
    const employeeIds = await Employee.find({
      name: { $regex: employeeName, $options: 'i' },
    }).distinct('_id');
    visitFilter.employeeToVisit = { $in: employeeIds };
  }

  let visitIds = null;
  if (Object.keys(visitFilter).length > 0) {
    visitIds = await Visit.find(visitFilter).distinct('_id');
  }

  const logFilter = {};
  if (visitIds) logFilter.visit = { $in: visitIds };
  if (action) logFilter.action = action;
  if (from || to) {
    logFilter.timestamp = {};
    if (from) logFilter.timestamp.$gte = startOfDay(from);
    if (to) {
      const end = startOfDay(to);
      end.setDate(end.getDate() + 1);
      logFilter.timestamp.$lt = end;
    }
  }

  const logs = await ActivityLog.find(logFilter)
    .populate('performedBy', 'name role')
    .populate({
      path: 'visit',
      populate: [
        { path: 'visitor', select: 'name phone' },
        { path: 'employeeToVisit', select: 'name department' },
      ],
    })
    .sort({ timestamp: -1 })
    .limit(1000);

  res.json(logs);
});

module.exports = { getActivityLogs };
