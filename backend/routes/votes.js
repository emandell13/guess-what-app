const express = require('express');
const router = express.Router();
const voteService = require('../services/voteService');
const supabase = require('../config/supabase');

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

// Submit a vote for tomorrow's question
router.post('/', async (req, res) => {
    try {
        const { response, sessionId } = req.body;
        
        if (!response || response.trim() === '') {
            return res.status(400).json({ error: 'Response is required' });
        }
        
        // Extract user ID from auth header if present
        let userId = null;
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
            const token = req.headers.authorization.split(' ')[1];
            try {
                const { data } = await supabase.auth.getUser(token);
                if (data && data.user) {
                    userId = data.user.id;
                }
            } catch (authError) {
                console.error('Auth error:', authError);
                // Continue without user ID
            }
        }
        
        // Log for debugging
        console.log(`Processing vote: userId=${userId}, sessionId=${sessionId}, response=${response}`);
        
        // Pass both identifiers to the service
        const data = await voteService.submitVote(response, sessionId, userId);
        
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

module.exports = router;