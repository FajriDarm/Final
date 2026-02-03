const express = require('express');
const commissionController = require('../controllers/commissionController');
const auth = require('../middleware/auth');

const router = express.Router();

// Debug middleware
router.use((req, res, next) => {
    console.log(`Commission Route: ${req.method} ${req.path}`);
    next();
});

// ALL ROUTES - No auth required for now (add auth later)
// PAGE ROUTES
router.get('/admin/commissions', commissionController.getAllCommissions);

// API ROUTES
router.get('/commissions', commissionController.getAllCommissionsAPI);
router.get('/commissions/stats', commissionController.getCommissionStats);
router.get('/commissions/events/list', commissionController.getEvents);
router.get('/commissions/:id', commissionController.getCommissionDetail);

// POST - Create new commission rule
router.post('/commissions', commissionController.createCommission);

// PUT - Update commission rule
router.put('/commissions/:id', commissionController.updateCommission);

// DELETE - Delete commission rule
router.delete('/commissions/:id', commissionController.deleteCommission);

// TODO: Add auth middleware later
// router.use(auth.verifyToken, (req, res, next) => {
//     if (!req.user || req.user.role_id !== 1) {
//         return res.status(403).json({ success: false, message: 'Unauthorized - Admin only' });
//     }
//     next();
// });

module.exports = router;
