// backend/services/gameService.js
const supabase = require('../config/supabase');
const streakService = require('./streakService');

/**
 * Handles user giving up on a game
 */
async function giveUp(userId = null, visitorId = null) {
    try {
        // Get all answers via HTTP call (like original)
        const response = await fetch(`${process.env.BASE_URL || 'http://localhost:3000'}/guesses/question?includeAnswers=true`);
        const data = await response.json();

        if (data.error) {
            throw new Error(data.error);
        }

        // Get question info for streak update
        const questionId = data.id;
        const activeDate = data.active_date;
        
        // Find existing game progress
        let query = supabase
            .from('game_progress')
            .select('id, completed')
            .eq('question_id', questionId);
            
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
                question_id: questionId,
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
        
        // Update streak - giving up is a loss (only for authenticated users)
        if (userId && activeDate) {
            await updateStreakForGameCompletion(userId, activeDate, false);
        }
        
        // Return remaining answers from the API response
        return {
            success: true,
            answers: data.answers ? data.answers.map(answer => ({
                rank: answer.rank,
                answer: answer.answer,
                voteCount: answer.rawVotes
            })) : []
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
 * Gets user stats based on the new scoring system (NO streak information)
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

        // NO STREAK DATA - let StreakService handle that
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

/**
 * Updates streak information when a game is completed (authenticated users only)
 * @param {string} userId - User ID
 * @param {string} gameDate - Date of the game (YYYY-MM-DD)
 * @param {boolean} isWin - Whether the user won
 * @returns {Promise<Object>} Streak update result
 */
async function updateStreakForGameCompletion(userId, gameDate, isWin) {
    try {
        if (!userId) {
            console.log('No user ID provided - skipping streak update (anonymous user)');
            return { success: true, message: 'Streaks only tracked for authenticated users' };
        }

        console.log(`Updating streak for game completion: userId=${userId}, date=${gameDate}, isWin=${isWin}`);
        
        // Update the streak
        const streakResult = await streakService.updateDailyWinStreak(userId, isWin, gameDate);
        
        if (!streakResult.success) {
            console.error('Failed to update streak:', streakResult.error);
            return streakResult;
        }
        
        console.log('Streak updated successfully:', streakResult.streak);
        return streakResult;
        
    } catch (error) {
        console.error('Error updating streak for game completion:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Process streak updates for completed games (for migration/batch processing)
 * @param {string} userId - Optional user ID filter
 * @returns {Promise<Object>} Processing result
 */
async function processStreakUpdatesForCompletedGames(userId = null) {
    try {
        console.log('Processing streak updates for completed games...');
        
        // Get all completed games for authenticated users
        let query = supabase
            .from('game_progress')
            .select(`
                *,
                questions (active_date)
            `)
            .eq('completed', true)
            .not('user_id', 'is', null) // Only process games from authenticated users
            .order('created_at', { ascending: true });
            
        if (userId) {
            query = query.eq('user_id', userId);
        }
        
        const { data: games, error } = await query;
        
        if (error) {
            console.error('Error fetching games for streak processing:', error);
            return { success: false, error: error.message };
        }
        
        console.log(`Found ${games.length} games to process for streaks`);
        
        let processed = 0;
        let errors = 0;
        
        // Process each game
        for (const game of games) {
            try {
                const isWin = game.completed && !game.gave_up;
                const gameDate = game.questions?.active_date;
                
                if (!gameDate) {
                    console.warn(`Skipping game ${game.id} - no active date found`);
                    continue;
                }
                
                const result = await updateStreakForGameCompletion(
                    game.user_id, 
                    gameDate, 
                    isWin
                );
                
                if (result.success) {
                    processed++;
                } else {
                    errors++;
                    console.error(`Failed to process streak for game ${game.id}:`, result.error);
                }
                
            } catch (gameError) {
                errors++;
                console.error(`Error processing game ${game.id}:`, gameError);
            }
        }
        
        console.log(`Streak processing complete: ${processed} processed, ${errors} errors`);
        
        return {
            success: true,
            processed,
            errors,
            total: games.length
        };
        
    } catch (error) {
        console.error('Error in processStreakUpdatesForCompletedGames:', error);
        return { success: false, error: error.message };
    }
}

module.exports = {
    giveUp,
    getUserStats,
    updateStreakForGameCompletion,
    processStreakUpdatesForCompletedGames
};