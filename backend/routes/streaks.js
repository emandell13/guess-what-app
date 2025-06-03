// backend/routes/streaks.js

const express = require('express');
const router = express.Router();
const streakService = require('../services/streakService');
const gameService = require('../services/gameService');
const authMiddleware = require('../middleware/authMiddleware');

// Get streak information for authenticated user
router.get('/', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Get streak information
        const result = await streakService.getStreakInfo(userId);
        
        if (!result.success) {
            return res.status(500).json(result);
        }
        
        res.json({
            success: true,
            streak: result.streak
        });
        
    } catch (error) {
        console.error('Error fetching streak information:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch streak information'
        });
    }
});

// Admin route: Process streak updates for completed games (migration/repair)
router.post('/process-completed-games', async (req, res) => {
    try {
        // This would typically require admin authentication
        // For now, we'll allow it but you should add admin auth middleware
        
        const { userId } = req.body; // Optional user filter
        
        const result = await gameService.processStreakUpdatesForCompletedGames(userId);
        
        res.json(result);
        
    } catch (error) {
        console.error('Error processing streak updates:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to process streak updates'
        });
    }
});

module.exports = router;