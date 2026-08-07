# Visitor Pass Management System (MERN Stack)

A full-stack visitor management application with role-based access control for
**Administrators**, **Receptionists**, and **Employees**, built with MongoDB,
Express.js, React.js, and Node.js.

## Project Structure

```
visitor-pass-system/
├── backend/     # Node.js + Express + MongoDB REST API
└── frontend/    # React + Tailwind CSS SPA
```

## Features

- JWT authentication with role-based route & API protection
- Role-specific dashboards (Admin / Receptionist / Employee)
- Employee directory management (Admin)
- User account management (Admin)
- Visitor registration workflow (Receptionist → Employee approval → Check-in/out)
- Search & filter by visitor name, employee name, visit date, and status
- Reports with Today / This Week / Custom Date Range filters
- Full activity history / audit trail for every visitor request
- All 10 business rules from the spec enforced server-side (see below)

## Business Rules Implemented

| # | Rule | Where enforced |
|---|------|-----------------|
| 1 | A visitor cannot have more than one active visit at a time | `visitController.registerVisit` |
| 2 | No duplicate registration for the same visitor on the same date | `visitController.registerVisit` |
| 3 | Visit date cannot be earlier than today | `visitController.registerVisit` |
| 4 | For today's registrations, arrival time cannot be earlier than now | `visitController.registerVisit` |
| 5 | An employee cannot have more than 3 pending requests | `visitController.registerVisit` |
| 6 | Visitors can only be checked in after approval | `visitController.checkInVisit` |
| 7 | Already checked-in visitors cannot be checked in again | `visitController.checkInVisit` (status guard) |
| 8 | Check-out time must be later than check-in time | `visitController.checkOutVisit` |
| 9 | Rejected requests cannot be checked in | `visitController.checkInVisit` (status guard) |
| 10 | Cancelled visits excluded from active visitor lists | `visitController.getVisits` (`activeOnly` filter) |

## Prerequisites

- Node.js 18+
- MongoDB running locally (or a MongoDB Atlas connection string)

## Setup

### 1. Backend

```bash
cd backend
cp .env.example .env      # edit MONGO_URI / JWT_SECRET as needed
npm install
npm run seed               # creates demo admin/receptionist/employee accounts
npm run dev                 # starts API on http://localhost:5000
```

**Demo accounts created by the seed script:**

| Role | Email | Password |
|------|-------|----------|
| Administrator | admin@company.com | Admin@123 |
| Receptionist | reception@company.com | Reception@123 |
| Employee | ravi.kumar@company.com | Employee@123 |
| Employee | priya.sharma@company.com | Employee@123 |

### 2. Frontend

```bash
cd frontend
cp .env.example .env       # points to the backend API URL
npm install
npm run dev                 # starts the app on http://localhost:5173
```

Open http://localhost:5173 and log in with any of the demo accounts above.

## Typical Workflow to Try

1. Log in as **reception@company.com** → "Register Visitor" → fill the form and
   pick "Ravi Kumar" as the employee to visit → submit.
2. Log out, log in as **ravi.kumar@company.com** → "Visitor Requests" → approve
   the request (optionally with remarks).
3. Log back in as the receptionist → "Visitor Management" → click **Check In**
   on the now-approved visit, then **Check Out** once done.
4. Log in as **admin@company.com** to view the dashboard, Reports, and full
   Activity History for that visit.

## API Overview

All endpoints are prefixed with `/api` and (except `/auth/login`) require a
`Authorization: Bearer <token>` header.

- `POST /auth/login`
- `GET /auth/me`
- `GET|POST|PUT|DELETE /users` (admin)
- `GET|POST|PUT|DELETE /employees` (read: any role, write: admin)
- `GET|POST /visits`, `GET /visits/:id`
- `PUT /visits/:id/approve|reject` (employee)
- `PUT /visits/:id/checkin|checkout|cancel` (receptionist/admin)
- `GET /dashboard` (role-aware stats)
- `GET /reports/summary?range=today|week|custom&from=&to=` (admin)
- `GET /activity-logs` (admin)

## Notes

- Passwords are hashed with bcrypt; JWTs expire after 8 hours by default.
- Deleting Employees/Users is a soft delete (`isActive: false`) to preserve
  historical visit records and audit trails.
- The Visitor directory is deduplicated by phone number so return visitors are
  matched to their existing history automatically.
