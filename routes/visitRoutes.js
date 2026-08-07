const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  registerVisit,
  getVisits,
  getVisit,
  approveVisit,
  rejectVisit,
  checkInVisit,
  checkOutVisit,
  cancelVisit,
} = require('../controllers/visitController');

router.use(protect);

router.get('/', authorize('admin', 'receptionist', 'employee'), getVisits);
router.get('/:id', authorize('admin', 'receptionist', 'employee'), getVisit);

router.post('/', authorize('receptionist'), registerVisit);

router.put('/:id/approve', authorize('employee'), approveVisit);
router.put('/:id/reject', authorize('employee'), rejectVisit);

router.put('/:id/checkin', authorize('receptionist'), checkInVisit);
router.put('/:id/checkout', authorize('receptionist'), checkOutVisit);

router.put('/:id/cancel', authorize('receptionist', 'admin'), cancelVisit);

module.exports = router;
