// backend/services/gameService.js
const supabase = require('../config/supabase');
const { getCurrentQuestion, getTopAnswers } = require('./guessService');

/**
 * Handles user giving up on a game
 */
async function giveUp(userId = null, visitorId = null) {
    try {
        const question = await getCurrentQuestion();
        const top5Answers = await getTopAnswers(question.id, 5);
        
        // Find existing game progress
        let query = supabase
            .from('game_progress')
            .select('id, completed')
            .eq('question_id', question.id);
            
        if (userId) {
            query = query.eq('user_id', userId);
        } else if (visitorId) {
            query = query.eq('visitor_id', visitorId);
        }
        
        const { data: progressData, error: progressError } = await query.single();
        
        // If we found progress, update it to mark as "gave up"
        if (!progressError && progressData && !progressData.completed) {
            await supabase
                .from('game_progress')
                .update({ 
                    gave_up: true,
                    completed: true
                })
                .eq('id', progressData.id);
        } else if (progressError) {
            // Create new progress record if none exists
            const newProgressData = {
                question_id: question.id,
                total_guesses: 0,
                strikes: 0,
                gave_up: true,
                completed: true
            };
            
            if (userId) newProgressData.user_id = userId;
            if (visitorId) newProgressData.visitor_id = visitorId;
            
            await supabase
                .from('game_progress')
                .insert([newProgressData]);
        }
        
        // Return all remaining answers
        return {
            success: true,
            answers: top5Answers.map(answer => ({
                rank: answer.rank,
                answer: answer.answer,
                voteCount: answer.vote_count
            }))
        };
    } catch (error) {
        console.error('Error in give up:', error);
        return {
            success: false,
            error: 'Failed to give up'
        };
    }
}

/**
 * Gets user stats based on the new scoring system
 */
async function getUserStats(userId) {
    try {
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
        const wins = games.filter(g => !g.gave_up).length;
        
        // Calculate average guesses for wins only
        const winGames = games.filter(g => !g.gave_up);
        const totalGuessesForWins = winGames.reduce((sum, game) => sum + (game.total_guesses || 0), 0);
        const avgGuesses = winGames.length > 0 ? Math.round(totalGuessesForWins / winGames.length) : 0;
        
        // Perfect games: Won and no incorrect guesses
        const perfectGames = games.filter(g => !g.gave_up && g.strikes === 0).length;

        return {
            success: true,
            stats: {
                totalGames,
                wins,
                avgGuesses,
                perfectGames,
                recentGames: games.slice(0, 5) // Return 5 most recent games
            }
        };
    } catch (error) {
        console.error('Error getting user stats:', error);
        return { 
            success: false, 
            error: 'Failed to get user statistics' 
        };
    }
}

module.exports = {
    giveUp,
    getUserStats
};