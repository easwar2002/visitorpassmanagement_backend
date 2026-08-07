const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { getActivityLogs } = require('../controllers/activityLogController');

router.get('/', protect, authorize('admin'), getActivityLogs);

module.exports = router;
