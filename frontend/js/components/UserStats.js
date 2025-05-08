// frontend/js/components/UserStats.js

import authService from '../services/AuthService.js';
import eventService from '../services/EventService.js';

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
      
      // Fetch user stats
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
      
      // Display stats
      this.updateStats(data.stats);
      
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
  
  // Update the stats boxes
  // 1. Games Played
  const totalGamesElement = document.getElementById('stats-total-games');
  if (totalGamesElement) {
    totalGamesElement.textContent = stats.totalGames || 0;
    // Try to update the title if it exists
    const title = totalGamesElement.closest('.card')?.querySelector('.card-title');
    if (title) title.textContent = 'Games Played';
  }
  
  // 2. Wins (previously high score)
  const winsElement = document.getElementById('stats-high-score');
  if (winsElement) {
    winsElement.textContent = stats.wins || 0;
    winsElement.id = 'stats-wins'; // Update the ID for future references
    // Update the label
    const title = winsElement.closest('.card')?.querySelector('.card-title');
    if (title) title.textContent = 'Wins';
  }
  
  // 3. Average Guesses (previously average score)
  const avgGuessesElement = document.getElementById('stats-avg-score');
  if (avgGuessesElement) {
    avgGuessesElement.textContent = stats.avgGuesses || 0;
    avgGuessesElement.id = 'stats-avg-guesses'; // Update the ID for future references
    // Update the label
    const title = avgGuessesElement.closest('.card')?.querySelector('.card-title');
    if (title) title.textContent = 'Average Guesses';
  }
  
  // 4. Perfect Games (remains the same)
  const perfectGamesElement = document.getElementById('stats-perfect-games');
  if (perfectGamesElement) {
    perfectGamesElement.textContent = stats.perfectGames || 0;
    // Title remains the same
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