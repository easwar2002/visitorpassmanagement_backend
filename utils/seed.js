require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const Employee = require('../models/Employee');

const run = async () => {
  await connectDB();

  console.log('Clearing existing Users and Employees...');
  await User.deleteMany({});
  await Employee.deleteMany({});

  console.log('Creating employee directory records...');
  const employees = await Employee.insertMany([
    { name: 'Ravi Kumar', email: 'ravi.kumar@company.com', phone: '9876500001', department: 'Engineering', designation: 'Senior Software Engineer' },
    { name: 'Priya Sharma', email: 'priya.sharma@company.com', phone: '9876500002', department: 'Human Resources', designation: 'HR Manager' },
    { name: 'Arjun Menon', email: 'arjun.menon@company.com', phone: '9876500003', department: 'Sales', designation: 'Sales Director' },
    { name: 'Divya Nair', email: 'divya.nair@company.com', phone: '9876500004', department: 'Finance', designation: 'Finance Analyst' },
  ]);

  console.log('Creating login accounts...');
  await User.create({
    name: 'System Administrator',
    email: 'admin@company.com',
    password: 'Admin@123',
    role: 'admin',
  });

  await User.create({
    name: 'Front Desk',
    email: 'reception@company.com',
    password: 'Reception@123',
    role: 'receptionist',
  });

  await User.create({
    name: 'Ravi Kumar',
    email: 'ravi.kumar@company.com',
    password: 'Employee@123',
    role: 'employee',
    employee: employees[0]._id,
  });

  await User.create({
    name: 'Priya Sharma',
    email: 'priya.sharma@company.com',
    password: 'Employee@123',
    role: 'employee',
    employee: employees[1]._id,
  });

  console.log('\nSeed complete. Login credentials:');
  console.table([
    { role: 'admin', email: 'admin@company.com', password: 'Admin@123' },
    { role: 'receptionist', email: 'reception@company.com', password: 'Reception@123' },
    { role: 'employee', email: 'ravi.kumar@company.com', password: 'Employee@123' },
    { role: 'employee', email: 'priya.sharma@company.com', password: 'Employee@123' },
  ]);

  await mongoose.connection.close();
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
