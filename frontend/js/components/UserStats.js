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
  
  // Update stats values
  document.getElementById('stats-total-games').textContent = stats.totalGames;
  document.getElementById('stats-high-score').textContent = stats.highScore;
  document.getElementById('stats-avg-score').textContent = stats.averageScore;
  document.getElementById('stats-perfect-games').textContent = stats.perfectGames;
  
  // Update recent games list
  this.updateRecentGames(stats.recentGames);
  
  // Show stats content, hide no games message
  if (noGamesMessage) noGamesMessage.style.display = 'none';
  if (statsContent) statsContent.style.display = 'block';
}

/**
 * Update the recent games list using the template
 * @param {Array} games - List of recent games
 */
updateRecentGames(games) {
  const recentGamesList = document.getElementById('recent-games-list');
  const noRecentGames = document.getElementById('no-recent-games');
  const recentGamesLoading = document.getElementById('recent-games-loading');
  const gameTemplate = document.getElementById('recent-game-template');
  
  // Hide loading indicator
  if (recentGamesLoading) recentGamesLoading.style.display = 'none';
  
  // Check if we have games
  if (!games || games.length === 0) {
    if (noRecentGames) noRecentGames.style.display = 'block';
    return;
  }
  
  // Hide no games message
  if (noRecentGames) noRecentGames.style.display = 'none';
  
  // Remove any existing game items (except the template)
  const existingItems = recentGamesList.querySelectorAll('.recent-game-item:not(#recent-game-template)');
  existingItems.forEach(item => item.remove());
  
  // Create game items using the template
  games.forEach(game => {
    // Clone the template
    const gameItem = gameTemplate.cloneNode(true);
    gameItem.id = `game-${game.id || Date.now()}`; // Use ID or timestamp as fallback
    gameItem.style.display = 'flex';
    
    // Update game date - convert to format like "Mar 17"
    const gameDate = new Date(game.created_at);
    const month = gameDate.toLocaleString('en-US', { month: 'short' });
    const day = gameDate.getDate();
    gameItem.querySelector('.game-date').textContent = `${month} ${day}`;
    
    // Update score
    gameItem.querySelector('.game-score').textContent = `${game.final_score} pts`;
    
    // Get the strike circles and reset them all to empty first
    const strikeCircles = gameItem.querySelectorAll('.game-strikes-container .strike-circle');
    strikeCircles.forEach(circle => {
      circle.classList.remove('filled');
      circle.classList.add('empty');
    });
    
    // Update only the necessary number of circles based on strikes
    const strikesCount = game.strikes || 0; // Default to 0 if strikes is undefined
    for (let i = 0; i < Math.min(strikesCount, strikeCircles.length); i++) {
      strikeCircles[i].classList.remove('empty');
      strikeCircles[i].classList.add('filled');
    }
    
    // Add to the list
    recentGamesList.appendChild(gameItem);
  });
}
}

export default UserStats;