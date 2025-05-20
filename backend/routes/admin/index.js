const express = require('express');
const router = express.Router();
const path = require('path'); // Add this import
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

// Add route for auto-generate social image page
router.get('/auto-generate-social-image', (req, res) => {
    res.sendFile(path.join(__dirname, '../../../frontend/admin/auto-generate-social-image.html'));
});

module.exports = router;