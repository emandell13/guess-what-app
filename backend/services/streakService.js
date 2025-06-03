// backend/services/streakService.js

const supabase = require('../config/supabase');
const { getTodayDate, getTomorrowDate } = require('../utils/dateUtils');

/**
 * Service for handling user win streaks (authenticated users only)
 */
const streakService = {
  /**
   * Update user's daily win streak after game completion
   * @param {string} userId - User ID (required - authenticated users only)
   * @param {boolean} isWin - Whether the user won today's game
   * @param {string} gameDate - Date of the game (YYYY-MM-DD format)
   * @returns {Promise<Object>} Updated streak information
   */
  async updateDailyWinStreak(userId, isWin, gameDate) {
    try {
      console.log(`Updating win streak: userId=${userId}, isWin=${isWin}, gameDate=${gameDate}`);
      
      if (!userId) {
        console.error('No user ID provided for streak update');
        return { success: false, error: 'User ID required for streak tracking' };
      }
      
      // Get or create streak record
      const streakRecord = await this.getOrCreateStreakRecord(userId);
      
      if (!streakRecord) {
        console.error('Failed to get or create streak record');
        return { success: false, error: 'Failed to get streak record' };
      }
      
      // Calculate new streak values
      const updatedStreak = this.calculateNewStreak(streakRecord, isWin, gameDate);
      
      // Update the database
      const { data, error } = await supabase
        .from('user_streaks')
        .update({
          current_daily_win_streak: updatedStreak.current,
          best_daily_win_streak: updatedStreak.best,
          last_win_date: updatedStreak.lastWinDate,
          updated_at: new Date().toISOString()
        })
        .eq('id', streakRecord.id)
        .select()
        .single();
        
      if (error) {
        console.error('Error updating streak record:', error);
        return { success: false, error: 'Failed to update streak' };
      }
      
      console.log(`Streak updated successfully: current=${updatedStreak.current}, best=${updatedStreak.best}`);
      
      return {
        success: true,
        streak: {
          current: updatedStreak.current,
          best: updatedStreak.best,
          lastWinDate: updatedStreak.lastWinDate,
          isNewBest: updatedStreak.isNewBest
        }
      };
      
    } catch (error) {
      console.error('Error updating daily win streak:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Get existing streak record or create a new one
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Streak record
   */
  async getOrCreateStreakRecord(userId) {
    try {
      // First try to find existing record
      const { data: existingRecord, error: queryError } = await supabase
        .from('user_streaks')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      // If record exists, return it
      if (!queryError && existingRecord) {
        console.log('Found existing streak record:', existingRecord);
        return existingRecord;
      }
      
      // If no record found, create a new one
      console.log('Creating new streak record for user:', userId);
      const newRecord = {
        user_id: userId,
        current_daily_win_streak: 0,
        best_daily_win_streak: 0,
        last_win_date: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      const { data: createdRecord, error: createError } = await supabase
        .from('user_streaks')
        .insert([newRecord])
        .select()
        .single();
        
      if (createError) {
        console.error('Error creating streak record:', createError);
        return null;
      }
      
      console.log('Created new streak record:', createdRecord);
      return createdRecord;
      
    } catch (error) {
      console.error('Error in getOrCreateStreakRecord:', error);
      return null;
    }
  },

  /**
   * Calculate new streak values based on current record and today's result
   * @param {Object} currentRecord - Current streak record
   * @param {boolean} isWin - Whether user won today
   * @param {string} gameDate - Date of the game
   * @returns {Object} New streak values
   */
  calculateNewStreak(currentRecord, isWin, gameDate) {
    const today = gameDate;
    const lastWinDate = currentRecord.last_win_date;
    const currentStreak = currentRecord.current_daily_win_streak || 0;
    const bestStreak = currentRecord.best_daily_win_streak || 0;
    
    console.log(`Calculating streak: today=${today}, lastWin=${lastWinDate}, current=${currentStreak}, isWin=${isWin}`);
    
    // If user didn't win today, streak is broken
    if (!isWin) {
      console.log('User did not win - streak reset to 0');
      return {
        current: 0,
        best: bestStreak,
        lastWinDate: null, // Clear last win date when streak breaks
        isNewBest: false
      };
    }
    
    // User won today - calculate new streak
    let newStreak = 1; // At minimum, they have a 1-day streak
    
    if (lastWinDate) {
      const yesterday = this.getYesterday(today);
      console.log(`Checking if last win (${lastWinDate}) was yesterday (${yesterday})`);
      
      if (lastWinDate === yesterday) {
        // Consecutive win - extend streak
        newStreak = currentStreak + 1;
        console.log(`Consecutive win - extending streak to ${newStreak}`);
      } else {
        // Non-consecutive win - restart streak
        newStreak = 1;
        console.log(`Non-consecutive win - starting new streak at 1`);
      }
    } else {
      // First win ever or first win after a break
      newStreak = 1;
      console.log('First win - starting streak at 1');
    }
    
    // Check if this is a new best
    const newBest = Math.max(bestStreak, newStreak);
    const isNewBest = newBest > bestStreak;
    
    if (isNewBest) {
      console.log(`New personal best streak: ${newBest}`);
    }
    
    return {
      current: newStreak,
      best: newBest,
      lastWinDate: today,
      isNewBest
    };
  },

  /**
   * Get yesterday's date in YYYY-MM-DD format
   * @param {string} todayDate - Today's date in YYYY-MM-DD format
   * @returns {string} Yesterday's date
   */
  getYesterday(todayDate) {
    const today = new Date(todayDate + 'T12:00:00-08:00'); // Parse in PT timezone
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    return yesterday.getFullYear() + '-' +
      String(yesterday.getMonth() + 1).padStart(2, '0') + '-' +
      String(yesterday.getDate()).padStart(2, '0');
  },

  /**
   * Get streak information for a user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Streak information
   */
  async getStreakInfo(userId) {
    try {
      if (!userId) {
        return { success: false, error: 'User ID required' };
      }
      
      const { data, error } = await supabase
        .from('user_streaks')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      if (error) {
        // If no record found, return default values
        if (error.code === 'PGRST116') {
          return {
            success: true,
            streak: {
              current: 0,
              best: 0,
              lastWinDate: null
            }
          };
        }
        
        console.error('Error fetching streak info:', error);
        return { success: false, error: error.message };
      }
      
      return {
        success: true,
        streak: {
          current: data.current_daily_win_streak || 0,
          best: data.best_daily_win_streak || 0,
          lastWinDate: data.last_win_date
        }
      };
      
    } catch (error) {
      console.error('Error getting streak info:', error);
      return { success: false, error: error.message };
    }
  }
};

module.exports = streakService;