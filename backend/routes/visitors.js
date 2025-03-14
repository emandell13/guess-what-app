const express = require('express');
const router = express.Router();
const visitorService = require('../services/visitorService');
const supabase = require('../config/supabase');

// Register or update a visitor
router.post('/register', async (req, res) => {
    try {
        const { visitorId } = req.body;
        
        if (!visitorId) {
            return res.status(400).json({ error: 'Visitor ID is required' });
        }
        
        // Extract user ID from auth header if present
        let userId = null;
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
            const token = req.headers.authorization.split(' ')[1];
            try {
                const { data, error } = await supabase.auth.getUser(token);
                if (!error && data && data.user) {
                    userId = data.user.id;
                }
            } catch (authError) {
                console.error('Auth error (non-critical):', authError);
            }
        }
        
        // Register visitor
        const visitor = await visitorService.ensureVisitorExists(visitorId, userId);
        
        if (!visitor) {
            throw new Error('Failed to register visitor');
        }
        
        res.json({ 
            success: true, 
            message: 'Visitor registered successfully' 
        });
    } catch (error) {
        console.error('Error registering visitor:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to register visitor' 
        });
    }
});

// Associate a visitor with a user (for when a user authenticates)
router.post('/associate', async (req, res) => {
    try {
        const { visitorId, userId } = req.body;
        
        if (!visitorId || !userId) {
            return res.status(400).json({ error: 'Both visitor ID and user ID are required' });
        }
        
        const success = await visitorService.associateVisitorWithUser(visitorId, userId);
        
        if (!success) {
            throw new Error('Failed to associate visitor with user');
        }
        
        res.json({ 
            success: true, 
            message: 'Visitor associated with user successfully'
        });
    } catch (error) {
        console.error('Error associating visitor with user:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to associate visitor with user'
        });
    }
});

module.exports = router;