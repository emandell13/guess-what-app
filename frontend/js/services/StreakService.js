// frontend/js/services/StreakService.js

import authService from './AuthService.js';
import eventService from './EventService.js';

/**
 * Service for handling streak data and operations
 */
class StreakService {
  constructor() {
    this.currentStreak = null;
    this.isLoading = false;
    
    // Listen for auth events to clear/load streak data
    this.setupEventListeners();
  }

  /**
   * Set up event listeners for auth state changes
   */
  setupEventListeners() {
    // Clear streak data when user logs out
    eventService.on('auth:logout', () => {
      this.currentStreak = null;
      this.emitStreakUpdate();
    });

    // Load streak data when user logs in
    eventService.on('auth:login', async () => {
      await this.loadStreakData();
    });

    // Clear streak data when token expires
    eventService.on('auth:token-expired', () => {
      this.currentStreak = null;
      this.emitStreakUpdate();
    });
  }

  /**
   * Get current streak information
   * @returns {Promise<Object>} Streak data or null if not authenticated
   */
  async getStreakInfo() {
    // If user is not authenticated, return null
    if (!authService.isAuthenticated()) {
      return null;
    }

    // If we have cached data, return it
    if (this.currentStreak) {
      return this.currentStreak;
    }

    // Otherwise, fetch from server
    return await this.loadStreakData();
  }

  /**
   * Load streak data from the server
   * @returns {Promise<Object|null>} Streak data or null if failed/not authenticated
   */
  async loadStreakData() {
    if (!authService.isAuthenticated()) {
      console.log('User not authenticated - no streak data available');
      return null;
    }

    if (this.isLoading) {
      console.log('Streak data already loading...');
      return this.currentStreak;
    }

    try {
      this.isLoading = true;
      console.log('Loading streak data from server...');

      const response = await fetch('/api/streaks', {
        headers: authService.getAuthHeaders()
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Token expired or invalid
          console.log('Authentication failed when loading streaks');
          authService.handleExpiredToken();
          return null;
        }
        throw new Error(`Failed to fetch streak data: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to load streak data');
      }

      // Cache the streak data
      this.currentStreak = data.streak;
      console.log('Streak data loaded:', this.currentStreak);

      // Emit event so components can update
      this.emitStreakUpdate();

      return this.currentStreak;

    } catch (error) {
      console.error('Error loading streak data:', error);
      this.currentStreak = null;
      return null;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Refresh streak data from server (force reload)
   * @returns {Promise<Object|null>} Updated streak data
   */
  async refreshStreakData() {
    this.currentStreak = null; // Clear cache
    return await this.loadStreakData();
  }

  /**
   * Get current streak count
   * @returns {number} Current streak or 0
   */
  getCurrentStreak() {
    return this.currentStreak?.current || 0;
  }

  /**
   * Get best streak count
   * @returns {number} Best streak or 0
   */
  getBestStreak() {
    return this.currentStreak?.best || 0;
  }

  /**
   * Get last win date
   * @returns {string|null} Last win date or null
   */
  getLastWinDate() {
    return this.currentStreak?.lastWinDate || null;
  }

  /**
   * Check if user has an active streak
   * @returns {boolean} True if current streak > 0
   */
  hasActiveStreak() {
    return this.getCurrentStreak() > 0;
  }

  /**
   * Check if user is authenticated and can have streaks
   * @returns {boolean} True if authenticated
   */
  isStreakTrackingAvailable() {
    return authService.isAuthenticated();
  }

  /**
   * Emit streak update event for components to listen to
   */
  emitStreakUpdate() {
    eventService.emit('streak:updated', {
      streak: this.currentStreak,
      isAuthenticated: authService.isAuthenticated()
    });
  }

  /**
   * Handle game completion - refresh streak data
   * This should be called after a game is completed to get updated streak info
   */
  async handleGameCompletion() {
    if (!authService.isAuthenticated()) {
      console.log('User not authenticated - no streak update needed');
      return;
    }

    console.log('Game completed - refreshing streak data...');
    
    // Add a small delay to ensure backend has processed the streak update
    setTimeout(async () => {
      const previousStreak = this.currentStreak ? { ...this.currentStreak } : null;
      const newStreak = await this.refreshStreakData();
      
      if (newStreak && previousStreak) {
        // Check if streak changed and emit specific events
        if (newStreak.current > previousStreak.current) {
          eventService.emit('streak:extended', {
            previousStreak: previousStreak.current,
            newStreak: newStreak.current,
            isNewBest: newStreak.best > previousStreak.best
          });
        } else if (newStreak.current === 0 && previousStreak.current > 0) {
          eventService.emit('streak:broken', {
            previousStreak: previousStreak.current,
            bestStreak: newStreak.best
          });
        }
      }
    }, 1000); // Wait 1 second for backend to process
  }

  /**
   * Get streak display text for UI
   * @returns {string} Formatted streak text
   */
  getStreakDisplayText() {
    if (!this.isStreakTrackingAvailable()) {
      return 'Log in to track streaks';
    }

    const current = this.getCurrentStreak();
    if (current === 0) {
      return 'No active streak';
    }

    if (current === 1) {
      return '1 day streak 🔥';
    }

    return `${current} day streak 🔥`;
  }

  /**
   * Get best streak display text for UI
   * @returns {string} Formatted best streak text
   */
  getBestStreakDisplayText() {
    if (!this.isStreakTrackingAvailable()) {
      return 'Log in to track streaks';
    }

    const best = this.getBestStreak();
    if (best === 0) {
      return 'No best streak yet';
    }

    if (best === 1) {
      return 'Best: 1 day';
    }

    return `Best: ${best} days`;
  }
}

// Create a singleton instance
const streakService = new StreakService();
export default streakService;