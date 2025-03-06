const express = require('express');
const router = express.Router();
const adminAuth = require('../../middleware/adminAuth');

// Apply auth middleware to all admin routes
router.use(adminAuth);

// Import route modules
const questionsRoutes = require('./questions');
const votesRoutes = require('./votes');
const toolsRoutes = require('./tools');

// Register route modules
router.use('/questions', questionsRoutes);
router.use('/votes', votesRoutes);
router.use('/tools', toolsRoutes);

module.exports = router;