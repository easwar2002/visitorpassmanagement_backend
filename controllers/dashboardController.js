const Visit = require('../models/Visit');
const Employee = require('../models/Employee');
const User = require('../models/User');
const { asyncHandler } = require('../middleware/errorHandler');
const { startOfDay } = require('../utils/dateUtils');

const todayRange = () => {
  const start = startOfDay(new Date());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
};

// GET /api/dashboard  - content depends on req.user.role
const getDashboard = asyncHandler(async (req, res) => {
  const { start, end } = todayRange();

  if (req.user.role === 'admin') {
    const [
      totalEmployees,
      totalUsers,
      todaysVisitors,
      visitorsInside,
      pendingRequests,
      scheduledUpcoming,
    ] = await Promise.all([
      Employee.countDocuments({ isActive: true }),
      User.countDocuments({ isActive: true }),
      Visit.countDocuments({ visitDate: { $gte: start, $lt: end }, status: { $ne: 'cancelled' } }),
      Visit.countDocuments({ status: 'checked-in' }),
      Visit.countDocuments({ status: 'pending' }),
      Visit.countDocuments({ visitDate: { $gte: end }, status: { $in: ['pending', 'approved'] } }),
    ]);

    return res.json({
      role: 'admin',
      cards: {
        totalEmployees,
        totalUsers,
        todaysVisitors,
        visitorsInside,
        pendingRequests,
        scheduledUpcoming,
      },
    });
  }

  if (req.user.role === 'receptionist') {
    const [todaysVisitors, visitorsInside, pendingApproval, checkedOutToday, cancelledToday] =
      await Promise.all([
        Visit.countDocuments({ visitDate: { $gte: start, $lt: end }, status: { $ne: 'cancelled' } }),
        Visit.countDocuments({ status: 'checked-in' }),
        Visit.countDocuments({ status: 'pending' }),
        Visit.countDocuments({
          status: 'checked-out',
          checkOutTime: { $gte: start, $lt: end },
        }),
        Visit.countDocuments({ visitDate: { $gte: start, $lt: end }, status: 'cancelled' }),
      ]);

    return res.json({
      role: 'receptionist',
      cards: { todaysVisitors, visitorsInside, pendingApproval, checkedOutToday, cancelledToday },
    });
  }

  if (req.user.role === 'employee') {
    if (!req.user.employee) {
      return res.json({
        role: 'employee',
        cards: { pendingRequests: 0, approvedToday: 0, todaysVisitors: 0, totalVisitsHosted: 0 },
        notice: 'Your account is not linked to an employee directory record.',
      });
    }

    const empId = req.user.employee;
    const [pendingRequests, approvedToday, todaysVisitors, totalVisitsHosted] = await Promise.all([
      Visit.countDocuments({ employeeToVisit: empId, status: 'pending' }),
      Visit.countDocuments({
        employeeToVisit: empId,
        status: { $in: ['approved', 'checked-in', 'checked-out'] },
        updatedAt: { $gte: start, $lt: end },
      }),
      Visit.countDocuments({
        employeeToVisit: empId,
        visitDate: { $gte: start, $lt: end },
        status: { $ne: 'cancelled' },
      }),
      Visit.countDocuments({ employeeToVisit: empId, status: { $ne: 'cancelled' } }),
    ]);

    return res.json({
      role: 'employee',
      cards: { pendingRequests, approvedToday, todaysVisitors, totalVisitsHosted },
    });
  }

  res.json({ role: req.user.role, cards: {} });
});

module.exports = { getDashboard };
