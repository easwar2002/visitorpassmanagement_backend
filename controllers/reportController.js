const Visit = require('../models/Visit');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { startOfDay } = require('../utils/dateUtils');

// Resolves a { start, end } Date range from the `range` query param.
const resolveRange = (range, from, to) => {
  const now = new Date();

  if (range === 'today') {
    const start = startOfDay(now);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end };
  }

  if (range === 'week') {
    const start = startOfDay(now);
    start.setDate(start.getDate() - start.getDay()); // back to Sunday
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return { start, end };
  }

  if (range === 'custom') {
    if (!from || !to) {
      throw new AppError('from and to dates are required for a custom range.', 400);
    }
    const start = startOfDay(from);
    const end = startOfDay(to);
    end.setDate(end.getDate() + 1); // inclusive of "to" date
    return { start, end };
  }

  throw new AppError('Invalid range. Use today, week, or custom.', 400);
};

// GET /api/reports/summary?range=today|week|custom&from=&to=
const getSummary = asyncHandler(async (req, res) => {
  const { range = 'today', from, to } = req.query;
  const { start, end } = resolveRange(range, from, to);

  const dateFilter = { visitDate: { $gte: start, $lt: end } };

  const [
    totalVisits,
    pending,
    approved,
    rejected,
    checkedIn,
    checkedOut,
    cancelled,
    byStatusAgg,
    byDepartmentAgg,
    byPurposeAgg,
  ] = await Promise.all([
    Visit.countDocuments(dateFilter),
    Visit.countDocuments({ ...dateFilter, status: 'pending' }),
    Visit.countDocuments({ ...dateFilter, status: 'approved' }),
    Visit.countDocuments({ ...dateFilter, status: 'rejected' }),
    Visit.countDocuments({ ...dateFilter, status: 'checked-in' }),
    Visit.countDocuments({ ...dateFilter, status: 'checked-out' }),
    Visit.countDocuments({ ...dateFilter, status: 'cancelled' }),
    Visit.aggregate([
      { $match: dateFilter },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Visit.aggregate([
      { $match: dateFilter },
      {
        $lookup: {
          from: 'employees',
          localField: 'employeeToVisit',
          foreignField: '_id',
          as: 'employee',
        },
      },
      { $unwind: '$employee' },
      { $group: { _id: '$employee.department', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Visit.aggregate([
      { $match: dateFilter },
      { $group: { _id: '$purpose', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),
  ]);

  res.json({
    range,
    from: start,
    to: end,
    totals: { totalVisits, pending, approved, rejected, checkedIn, checkedOut, cancelled },
    byStatus: byStatusAgg.map((r) => ({ status: r._id, count: r.count })),
    byDepartment: byDepartmentAgg.map((r) => ({ department: r._id, count: r.count })),
    byPurpose: byPurposeAgg.map((r) => ({ purpose: r._id, count: r.count })),
  });
});

module.exports = { getSummary };
