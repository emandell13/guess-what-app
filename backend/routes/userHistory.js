const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const authMiddleware = require('../middleware/authMiddleware');
const gameService = require('../services/gameService');


// Save game progress route
router.post('/save-game', async (req, res) => {
  try {
    const { question_id, final_score, strikes, completed, visitor_id } = req.body;
    
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
        console.error('Auth error (non-critical):', authError);
      }
    }
    
    // We need at least a visitor_id or user_id
    if (!visitor_id && !userId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Either visitor_id or user_id is required' 
      });
    }
    
    // Try to find existing game progress record
    let query = supabase
      .from('game_progress')
      .select('id, final_score, strikes')
      .eq('question_id', question_id);
      
    // Add identifier filters
    if (userId) {
      query = query.eq('user_id', userId);
    } else if (visitor_id) {
      query = query.eq('visitor_id', visitor_id);
    }
    
    const { data: existingGame, error: queryError } = await query.single();
    
    // If the game progress exists, update it; otherwise create a new one
    if (!queryError && existingGame) {
      // Only update with higher score or more strikes
      const newScore = Math.max(existingGame.final_score, final_score);
      const newStrikes = Math.max(existingGame.strikes, strikes);
      
      // Update existing record
      const { error: updateError } = await supabase
        .from('game_progress')
        .update({
          final_score: newScore,
          strikes: newStrikes,
          completed: completed || existingGame.completed,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingGame.id);
        
      if (updateError) {
        throw updateError;
      }
      
      res.json({
        success: true,
        message: 'Game progress updated'
      });
    } else {
      // Create a new record
      const gameData = {
        question_id,
        final_score,
        strikes,
        completed
      };
      
      // Add identifiers
      if (userId) {
        gameData.user_id = userId;
      }
      
      if (visitor_id) {
        gameData.visitor_id = visitor_id;
      }
      
      const { error: insertError } = await supabase
        .from('game_progress')
        .insert([gameData]);
        
      if (insertError) {
        throw insertError;
      }
      
      res.json({
        success: true,
        message: 'Game progress saved'
      });
    }
  } catch (error) {
    console.error('Error saving game progress:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to save game progress' 
    });
  }
});

// Get user statistics
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await gameService.getUserStats(userId);
    res.json(result);
  } catch (error) {
    console.error('Error getting user stats:', error);
    res.status(500).json({ error: 'Failed to get user statistics' });
  }
});

module.exports = router;