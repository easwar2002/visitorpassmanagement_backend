const User = require('../models/User');
const Employee = require('../models/Employee');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

// GET /api/users
const getUsers = asyncHandler(async (req, res) => {
  const users = await User.find().populate('employee', 'name email department').sort({ createdAt: -1 });
  res.json(users.map((u) => u.toSafeObject()));
});

// GET /api/users/:id
const getUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).populate('employee');
  if (!user) throw new AppError('User not found.', 404);
  res.json(user.toSafeObject());
});

// POST /api/users
const createUser = asyncHandler(async (req, res) => {
  const { name, email, password, role, employee } = req.body;

  if (!name || !email || !password || !role) {
    throw new AppError('name, email, password and role are required.', 400);
  }
  if (!['admin', 'receptionist', 'employee'].includes(role)) {
    throw new AppError('Invalid role.', 400);
  }

  let employeeId = null;
  if (role === 'employee') {
    if (!employee) {
      throw new AppError('An employee account must be linked to an Employee record.', 400);
    }
    const emp = await Employee.findById(employee);
    if (!emp) throw new AppError('Linked employee record not found.', 404);

    const existingLink = await User.findOne({ employee });
    if (existingLink) {
      throw new AppError('This employee already has a linked user account.', 409);
    }
    employeeId = employee;
  }

  const user = await User.create({
    name,
    email: email.toLowerCase(),
    password,
    role,
    employee: employeeId,
  });

  res.status(201).json(user.toSafeObject());
});

// PUT /api/users/:id
const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new AppError('User not found.', 404);

  const { name, email, role, isActive, employee, password } = req.body;

  if (name !== undefined) user.name = name;
  if (email !== undefined) user.email = email.toLowerCase();
  if (isActive !== undefined) user.isActive = isActive;
  if (password) user.password = password; // will be re-hashed by pre-save hook

  if (role !== undefined) {
    if (!['admin', 'receptionist', 'employee'].includes(role)) {
      throw new AppError('Invalid role.', 400);
    }
    user.role = role;
    if (role === 'employee' && employee) {
      user.employee = employee;
    } else if (role !== 'employee') {
      user.employee = null;
    }
  }

  await user.save();
  res.json(user.toSafeObject());
});

// DELETE /api/users/:id  (soft delete -> deactivate)
const deleteUser = asyncHandler(async (req, res) => {
  if (req.params.id === String(req.user._id)) {
    throw new AppError('You cannot deactivate your own account.', 400);
  }
  const user = await User.findById(req.params.id);
  if (!user) throw new AppError('User not found.', 404);

  user.isActive = false;
  await user.save();
  res.json({ message: 'User deactivated successfully.' });
});

module.exports = { getUsers, getUser, createUser, updateUser, deleteUser };
