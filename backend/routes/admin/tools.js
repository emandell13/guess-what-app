const express = require('express');
const router = express.Router();
const dailyUpdate = require('../../scripts/dailyUpdate');
const { testMatching } = require('../../utils/textUtils');

// Run the daily update manually
router.get('/run-update', async (req, res) => {
    try {
        const result = await dailyUpdate();
        res.json({ 
            success: result.success, 
            message: 'Daily update executed manually',
            details: result
        });
    } catch (error) {
        console.error('Error running update:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Test text matching functionality
router.post('/test-matching', async (req, res) => {
    try {
        const { text1, text2 } = req.body;
        
        if (!text1 || !text2) {
            return res.status(400).json({ 
                error: 'Both text values are required' 
            });
        }
        
        const result = testMatching(text1, text2);
        res.json(result);
    } catch (error) {
        console.error('Error testing text matching:', error);
        res.status(500).json({ error: 'Failed to test text matching' });
    }
});

module.exports = router;