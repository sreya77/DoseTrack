const router = require('express').Router();
const { requireAuth, requireAdmin } = require('../../middleware/auth');

// Public auth routes (admin login)
router.use('/auth', require('./auth'));

// Protect all following routes with requireAuth & requireAdmin
router.use(requireAuth, requireAdmin);

// All Admin Modules
router.use('/dashboard', require('./dashboard'));
router.use('/users', require('./users'));
router.use('/medications', require('./medications'));
router.use('/adherence', require('./adherence'));
router.use('/doctors', require('./doctors'));
router.use('/care-circles', require('./careCircles'));
router.use('/reminders', require('./reminders'));
router.use('/reports', require('./reports'));
router.use('/audit', require('./audit'));

module.exports = router;

