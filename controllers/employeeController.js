const Employee = require('../models/Employee');
const User = require('../models/User');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

// GET /api/employees  (any authenticated role - needed for "employee to visit" dropdown)
const getEmployees = asyncHandler(async (req, res) => {
  const { search, department, isActive } = req.query;
  const filter = {};

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { department: { $regex: search, $options: 'i' } },
    ];
  }
  if (department) filter.department = department;
  if (isActive !== undefined) filter.isActive = isActive === 'true';

  const employees = await Employee.find(filter).sort({ name: 1 });
  res.json(employees);
});

// GET /api/employees/:id
const getEmployee = asyncHandler(async (req, res) => {
  const employee = await Employee.findById(req.params.id);
  if (!employee) throw new AppError('Employee not found.', 404);
  res.json(employee);
});

// POST /api/employees  (admin only)
const createEmployee = asyncHandler(async (req, res) => {
  const { name, email, phone, department, designation } = req.body;
  if (!name || !email || !phone || !department || !designation) {
    throw new AppError('All employee fields are required.', 400);
  }
  const employee = await Employee.create({
    name,
    email: email.toLowerCase(),
    phone,
    department,
    designation,
  });
  res.status(201).json(employee);
});

// PUT /api/employees/:id (admin only)
const updateEmployee = asyncHandler(async (req, res) => {
  const employee = await Employee.findById(req.params.id);
  if (!employee) throw new AppError('Employee not found.', 404);

  const { name, email, phone, department, designation, isActive } = req.body;
  if (name !== undefined) employee.name = name;
  if (email !== undefined) employee.email = email.toLowerCase();
  if (phone !== undefined) employee.phone = phone;
  if (department !== undefined) employee.department = department;
  if (designation !== undefined) employee.designation = designation;
  if (isActive !== undefined) employee.isActive = isActive;

  await employee.save();
  res.json(employee);
});

// DELETE /api/employees/:id (admin only) - soft delete
const deleteEmployee = asyncHandler(async (req, res) => {
  const employee = await Employee.findById(req.params.id);
  if (!employee) throw new AppError('Employee not found.', 404);

  const linkedUser = await User.findOne({ employee: employee._id });
  if (linkedUser) {
    throw new AppError(
      'This employee has a linked login account. Deactivate the user account first.',
      400
    );
  }

  employee.isActive = false;
  await employee.save();
  res.json({ message: 'Employee deactivated successfully.' });
});

module.exports = { getEmployees, getEmployee, createEmployee, updateEmployee, deleteEmployee };
