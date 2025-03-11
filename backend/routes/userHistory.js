const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/save-game', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { question_id, final_score, strikes, completed, correct_answers } = req.body;
    
    // Check if a record already exists for this user and question
    const { data: existingGame, error: queryError } = await supabase
      .from('user_game_progress')
      .select('id')
      .eq('user_id', userId)
      .eq('question_id', question_id)
      .single();
    
    let result;
    
    if (!queryError && existingGame) {
      // Update existing record
      const { data, error } = await supabase
        .from('user_game_progress')
        .update({
          final_score,
          strikes,
          completed,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingGame.id)
        .select();
      
      if (error) throw error;
      result = { success: true, updated: true, data };
    } else {
      // Create new record
      const { data, error } = await supabase
        .from('user_game_progress')
        .insert([{
          user_id: userId,
          question_id,
          final_score,
          strikes,
          completed
        }])
        .select();
      
      if (error) throw error;
      result = { success: true, created: true, data };
      
      // If correct_answers provided, save individual guesses
      if (correct_answers && correct_answers.length > 0 && data[0].id) {
        const guesses = correct_answers.map(answer => ({
          user_id: userId,
          question_id,
          game_progress_id: data[0].id,
          guess_text: answer.guess,
          is_correct: true,
          points_earned: answer.points,
          created_at: new Date().toISOString()
        }));
        
        await supabase
          .from('user_guesses')
          .insert(guesses);
      }
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error saving game data:', error);
    res.status(500).json({ error: 'Failed to save game data' });
  }
});

// Get user statistics
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get all completed games
    const { data: games, error: gamesError } = await supabase
      .from('user_game_progress')
      .select('*')
      .eq('user_id', userId)
      .eq('completed', true)
      .order('created_at', { ascending: false });
    
    if (gamesError) throw gamesError;
    
    // Calculate statistics
    const totalGames = games.length;
    const totalScore = games.reduce((sum, game) => sum + game.final_score, 0);
    const averageScore = totalGames > 0 ? Math.round(totalScore / totalGames) : 0;
    const highScore = games.length > 0 ? Math.max(...games.map(g => g.final_score)) : 0;
    const perfectGames = games.filter(g => g.strikes === 0).length;
    
    res.json({
      success: true,
      stats: {
        totalGames,
        averageScore,
        highScore,
        perfectGames,
        recentGames: games.slice(0, 5) // Return 5 most recent games
      }
    });
  } catch (error) {
    console.error('Error getting user stats:', error);
    res.status(500).json({ error: 'Failed to get user statistics' });
  }
});

module.exports = router;