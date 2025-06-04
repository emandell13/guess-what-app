// frontend/js/components/UserStats.js

import authService from '../services/AuthService.js';
import eventService from '../services/EventService.js';
import streakService from '../services/StreakService.js';

/**
 * Component for displaying user statistics
 */
class UserStats {
  /**
   * Creates a new UserStats component
   * @param {string} containerId - The ID of the container element
   */
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    
    // Load stats when created
    this.loadStats();
    
    // Set up event listeners for auth state changes
    eventService.on('auth:login', () => this.loadStats());
    eventService.on('auth:logout', () => {
      this.container.querySelector('.no-games-message').textContent = 'Please log in to view your statistics.';
      this.container.querySelector('.no-games-message').style.display = 'block';
      this.container.querySelector('.stats-content').style.display = 'none';
    });

    // Listen for streak updates
    eventService.on('streak:updated', () => this.updateStreakDisplay());
  }
  
  /**
   * Load user statistics from the server
   */
  async loadStats() {
    try {
      // Show loading state
      const noGamesMessage = this.container.querySelector('.no-games-message');
      const statsContent = this.container.querySelector('.stats-content');
      
      // Check if user is authenticated
      if (!authService.isAuthenticated()) {
        if (noGamesMessage) {
          noGamesMessage.textContent = 'Please log in to view your statistics.';
          noGamesMessage.style.display = 'block';
        }
        if (statsContent) statsContent.style.display = 'none';
        return;
      }
      
      // Fetch user stats (without streak data)
      const response = await fetch('/user/stats', {
        headers: authService.getAuthHeaders()
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch statistics');
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to load statistics');
      }
      
      // Display stats (game stats only)
      this.updateStats(data.stats);
      
      // Load and display streak data from StreakService
      await this.updateStreakDisplay();
      
      // Emit an event when stats are loaded
      eventService.emit('stats:loaded', {
        stats: data.stats
      });
    } catch (error) {
      console.error('Error loading stats:', error);
      
      // Check if token expired
      if (error.message && error.message.includes('token expired')) {
        // Token expiration is now handled by the AuthService
        return;
      }
      
      const noGamesMessage = this.container.querySelector('.no-games-message');
      const statsContent = this.container.querySelector('.stats-content');
      
      if (noGamesMessage) {
        noGamesMessage.innerHTML = `
          <div class="alert alert-warning">
            <i class="fas fa-exclamation-triangle me-2"></i>
            Unable to load your statistics
          </div>
        `;
        noGamesMessage.style.display = 'block';
      }
      if (statsContent) statsContent.style.display = 'none';
      
      // Emit error event
      eventService.emit('stats:error', {
        error: error.message
      });
    }
  }

  /**
   * Update the streak display with current data
   */
  async updateStreakDisplay() {
          // Get streak element (only current streak now)
    const currentStreakElement = document.getElementById('stats-current-streak');
    
    if (!authService.isAuthenticated()) {
      // User not authenticated - clear streak display
      if (currentStreakElement) {
        currentStreakElement.textContent = '0';
        const title = currentStreakElement.closest('.card')?.querySelector('.card-title');
        if (title) title.textContent = 'Win Streak';
      }
      return;
    }

    try {
      // Get streak data
      const streakData = await streakService.getStreakInfo();
      
      if (streakData) {
        // Update current streak
        if (currentStreakElement) {
          currentStreakElement.textContent = streakData.current || 0;
          const title = currentStreakElement.closest('.card')?.querySelector('.card-title');
          if (title) title.textContent = 'Win Streak';
        }
      }
    } catch (error) {
      console.error('Error updating streak display:', error);
      // Set to 0 on error
      if (currentStreakElement) currentStreakElement.textContent = '0';
    }
  }
  
 /**
 * Update the stats display with new data
 * @param {Object} stats - The statistics data
 */
updateStats(stats) {
  const noGamesMessage = this.container.querySelector('.no-games-message');
  const statsContent = this.container.querySelector('.stats-content');
  
  // Check if we have any games played
  if (stats.totalGames === 0) {
    if (noGamesMessage) {
      noGamesMessage.innerHTML = '<p>Play some games to see your statistics here!</p>';
      noGamesMessage.style.display = 'block';
    }
    if (statsContent) statsContent.style.display = 'none';
    return;
  }
  
  // Update the stats boxes - they're already in the correct layout in HTML
  // Row 1: Games Played | Total Wins
  // Row 2: Win Streak | Perfect Games
  
  // 1. Games Played (top left)
  const totalGamesElement = document.getElementById('stats-total-games');
  if (totalGamesElement) {
    totalGamesElement.textContent = stats.totalGames || 0;
  }
  
  // 2. Total Wins (top right)
  const winsElement = document.getElementById('stats-high-score');
  if (winsElement) {
    winsElement.textContent = stats.wins || 0;
  }
  
  // 3. Win Streak (bottom left) - will be updated by updateStreakDisplay()
  
  // 4. Perfect Games (bottom right)
  const perfectGamesElement = document.getElementById('stats-perfect-games');
  if (perfectGamesElement) {
    perfectGamesElement.textContent = stats.perfectGames || 0;
  }
  
  // Hide the recent games section
  const recentGamesHeader = this.container.querySelector('h3.mt-4.mb-3');
  if (recentGamesHeader) {
    recentGamesHeader.style.display = 'none';
  }
  
  const recentGamesContainer = document.getElementById('recent-games-container');
  if (recentGamesContainer) {
    recentGamesContainer.style.display = 'none';
  }
  
  // Show stats content, hide no games message
  if (noGamesMessage) noGamesMessage.style.display = 'none';
  if (statsContent) statsContent.style.display = 'block';
}
}

export default UserStats;