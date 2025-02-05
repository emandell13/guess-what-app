const express = require('express');
const router = express.Router();
const voteService = require('../services/voteService');

// Submit a vote for tomorrow's question
router.post('/', async (req, res) => {
    try {
        const { response } = req.body;
        const data = await voteService.submitVote(response);
        res.json({ 
            message: 'Vote recorded successfully',
            data 
        });
    } catch (error) {
        console.error('Error handling vote:', error);
        res.status(500).json({ 
            error: error.message 
        });
    }
});

// Get the current voting question
router.get('/question', async (req, res) => {
    try {
        const question = await voteService.getCurrentQuestion();
        res.json({ question });
    } catch (error) {
        console.error('Error fetching question:', error);
        res.status(500).json({ 
            error: error.message 
        });
    }
});

module.exports = router;