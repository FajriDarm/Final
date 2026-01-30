const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authMiddleware = require('../middleware/auth');

// Public endpoint for active events (no auth required)
router.get('/events/active', adminController.getActiveEvents);

// Dashboard
router.get('/dashboard/stats', adminController.getDashboardStats);

// Users - Remove auth temporarily for development
router.get('/users', adminController.getUsers);

// Events - Remove auth temporarily for development
router.get('/events', adminController.getEvents);
router.post('/events', adminController.createEvent);
router.put('/events/:eventId', adminController.updateEvent);
router.delete('/events/:eventId', adminController.deleteEvent);

// Affiliates - Remove auth temporarily for development
router.get('/affiliates/pending', adminController.getPendingAffiliates);
router.put('/affiliates/:userId/approve', adminController.approveAffiliate);
router.put('/affiliates/:userId/reject', adminController.rejectAffiliate);

// Activity Logs - Remove auth temporarily for development
router.get('/activity-logs', adminController.getActivityLogs);

module.exports = router;
