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
      this.container.innerHTML = '<p>Please log in to view your statistics.</p>';
    });
  }
  
  /**
   * Load user statistics from the server
   */
  async loadStats() {
    try {
      // Show loading state
      this.container.innerHTML = '<p><em>Loading your statistics...</em></p>';
      
      // Check if user is authenticated
      if (!authService.isAuthenticated()) {
        this.container.innerHTML = '<p>Please log in to view your statistics.</p>';
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
      this.displayStats(data.stats);
      
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
      
      this.container.innerHTML = `
        <div class="alert alert-warning">
          <i class="fas fa-exclamation-triangle me-2"></i>
          Unable to load your statistics
        </div>
      `;
      
      // Emit error event
      eventService.emit('stats:error', {
        error: error.message
      });
    }
  }
  
  /**
   * Display the user's statistics
   * @param {Object} stats - The statistics data
   */
  displayStats(stats) {
    // Check if we have any games played
    if (stats.totalGames === 0) {
      this.container.innerHTML = '<p>Play some games to see your statistics here!</p>';
      return;
    }
    
    // Create stats display
    this.container.innerHTML = `
      <div class="row">
        <div class="col-6 mb-3">
          <div class="card">
            <div class="card-body text-center">
              <h6 class="card-title">Games Played</h6>
              <p class="fs-4 mb-0">${stats.totalGames}</p>
            </div>
          </div>
        </div>
        <div class="col-6 mb-3">
          <div class="card">
            <div class="card-body text-center">
              <h6 class="card-title">High Score</h6>
              <p class="fs-4 mb-0">${stats.highScore}</p>
            </div>
          </div>
        </div>
        <div class="col-6 mb-3">
          <div class="card">
            <div class="card-body text-center">
              <h6 class="card-title">Average Score</h6>
              <p class="fs-4 mb-0">${stats.averageScore}</p>
            </div>
          </div>
        </div>
        <div class="col-6 mb-3">
          <div class="card">
            <div class="card-body text-center">
              <h6 class="card-title">Perfect Games</h6>
              <p class="fs-4 mb-0">${stats.perfectGames}</p>
            </div>
          </div>
        </div>
      </div>
      
      <h5 class="mt-4">Recent Games</h5>
      ${this.renderRecentGames(stats.recentGames)}
    `;
  }
  
  /**
   * Render the list of recent games
   * @param {Array} games - List of recent games
   * @returns {string} HTML for recent games
   */
  renderRecentGames(games) {
    if (!games || games.length === 0) {
      return '<p>No recent games found.</p>';
    }
    
    return `
      <div class="list-group">
        ${games.map(game => `
          <div class="list-group-item d-flex justify-content-between align-items-center">
            <div>
              <strong>${new Date(game.created_at).toLocaleDateString()}</strong>
              ${game.completed ? 
                `<span class="badge bg-success ms-2">Completed</span>` : 
                `<span class="badge bg-warning ms-2">In Progress</span>`
              }
            </div>
            <div>
              <span class="badge bg-primary rounded-pill">${game.final_score} pts</span>
              <span class="text-danger ms-2">
                ${Array(game.strikes).fill('<i class="fas fa-times"></i>').join('')}
              </span>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }
}

export default UserStats;