const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/save-guess', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { question_id, guess_text, is_correct, points_earned, matched_answer_id } = req.body;
    
    // First, get question details to know max answers and max score
    const { data: questionData } = await supabase
      .from('questions')
      .select('*')
      .eq('id', question_id)
      .single();
    
    // Get top answers to determine max score
    const { data: topAnswers } = await supabase
      .from('top_answers')
      .select('*')
      .eq('question_id', question_id)
      .order('rank', { ascending: true });
    
    const MAX_STRIKES = 3; // Define max strikes
    const answerCount = topAnswers.filter(answer => answer.rank <= 5).length;
    
    // Find or create game progress record
    let gameProgressId;
    
    // Check if a game progress record exists
    const { data: existingGame, error: queryError } = await supabase
      .from('game_progress')
      .select('id, final_score, strikes')
      .eq('user_id', userId)
      .eq('question_id', question_id)
      .single();
    
    // Check if this correct guess already exists to avoid duplicate points
    let isDuplicateGuess = false;
    let correctGuessCount = 0;
    
    if (is_correct && matched_answer_id) {
      const { data: existingGuess } = await supabase
        .from('guesses')
        .select('id')
        .eq('user_id', userId)
        .eq('question_id', question_id)
        .eq('matched_answer_id', matched_answer_id)
        .single();
      
      isDuplicateGuess = !!existingGuess;
      
      // Count how many unique correct guesses the user has made
      const { data: correctGuesses } = await supabase
        .from('guesses')
        .select('matched_answer_id')
        .eq('user_id', userId)
        .eq('question_id', question_id)
        .eq('is_correct', true);
      
      if (correctGuesses) {
        // Get unique answer IDs
        const uniqueAnswerIds = new Set(correctGuesses.map(g => g.matched_answer_id));
        correctGuessCount = uniqueAnswerIds.size;
      }
    }
    
    let newScore, newStrikes;
    
    if (!queryError && existingGame) {
      // Update existing record
      gameProgressId = existingGame.id;
      
      // Only add points if it's a correct and non-duplicate guess
      // Only increment strikes if it's incorrect
      newScore = is_correct && !isDuplicateGuess 
        ? existingGame.final_score + points_earned 
        : existingGame.final_score;
        
      newStrikes = !is_correct 
        ? existingGame.strikes + 1 
        : existingGame.strikes;
      
      // Check if game is completed
      const allAnswersFound = correctGuessCount >= answerCount || newScore >= 100;
      const maxStrikesReached = newStrikes >= MAX_STRIKES;
      const isCompleted = allAnswersFound || maxStrikesReached;
      
      await supabase
        .from('game_progress')
        .update({
          final_score: newScore,
          strikes: newStrikes,
          completed: isCompleted,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingGame.id);
    } else {
      // Create new game progress record
      newScore = is_correct ? points_earned : 0;
      newStrikes = is_correct ? 0 : 1;
      
      // Check if game is completed with first guess (unlikely but possible)
      const isCompleted = (is_correct && points_earned >= 100) || newStrikes >= MAX_STRIKES;
      
      const { data, error } = await supabase
        .from('game_progress')
        .insert([{
          user_id: userId,
          question_id,
          final_score: newScore,
          strikes: newStrikes,
          completed: isCompleted
        }])
        .select();
      
      if (error) throw error;
      gameProgressId = data[0].id;
    }
    
    // Always save the guess for history tracking
    const { error: guessError } = await supabase
      .from('guesses')
      .insert([{
        user_id: userId,
        question_id,
        game_progress_id: gameProgressId,
        guess_text,
        is_correct,
        points_earned: is_correct && !isDuplicateGuess ? points_earned : 0,
        matched_answer_id: is_correct ? matched_answer_id : null,
        created_at: new Date().toISOString()
      }]);
    
    if (guessError) throw guessError;
    
    res.json({
      success: true,
      message: 'Guess saved successfully'
    });
  } catch (error) {
    console.error('Error saving guess:', error);
    res.status(500).json({ error: 'Failed to save guess' });
  }
});

// Get user statistics
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get all completed games
    const { data: games, error: gamesError } = await supabase
      .from('game_progress')
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