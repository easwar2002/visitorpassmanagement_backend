const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { getSummary } = require('../controllers/reportController');

router.get('/summary', protect, authorize('admin'), getSummary);

module.exports = router;
