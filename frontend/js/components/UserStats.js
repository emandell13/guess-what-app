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
      
      // Load and display streak data
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
    // Get streak elements
    const currentStreakElement = document.getElementById('stats-current-streak');
    const bestStreakElement = document.getElementById('stats-best-streak');
    
    if (!authService.isAuthenticated()) {
      // User not authenticated - clear streak display
      if (currentStreakElement) {
        currentStreakElement.textContent = '0';
        const title = currentStreakElement.closest('.card')?.querySelector('.card-title');
        if (title) title.textContent = 'Current Streak';
      }
      if (bestStreakElement) {
        bestStreakElement.textContent = '0';
        const title = bestStreakElement.closest('.card')?.querySelector('.card-title');
        if (title) title.textContent = 'Best Streak';
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
          if (title) title.textContent = 'Current Streak';
        }
        
        // Update best streak
        if (bestStreakElement) {
          bestStreakElement.textContent = streakData.best || 0;
          const title = bestStreakElement.closest('.card')?.querySelector('.card-title');
          if (title) title.textContent = 'Best Streak';
        }
      }
    } catch (error) {
      console.error('Error updating streak display:', error);
      // Set to 0 on error
      if (currentStreakElement) currentStreakElement.textContent = '0';
      if (bestStreakElement) bestStreakElement.textContent = '0';
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
  
  // Update the existing stats boxes (keep all original stats)
  // 1. Games Played
  const totalGamesElement = document.getElementById('stats-total-games');
  if (totalGamesElement) {
    totalGamesElement.textContent = stats.totalGames || 0;
    const title = totalGamesElement.closest('.card')?.querySelector('.card-title');
    if (title) title.textContent = 'Games Played';
  }
  
  // 2. Wins (previously high score)
  const winsElement = document.getElementById('stats-high-score');
  if (winsElement) {
    winsElement.textContent = stats.wins || 0;
    winsElement.id = 'stats-wins';
    const title = winsElement.closest('.card')?.querySelector('.card-title');
    if (title) title.textContent = 'Wins';
  }
  
  // 3. Average Guesses (keep this one)
  const avgGuessesElement = document.getElementById('stats-avg-score');
  if (avgGuessesElement) {
    avgGuessesElement.textContent = stats.avgGuesses || 0;
    avgGuessesElement.id = 'stats-avg-guesses';
    const title = avgGuessesElement.closest('.card')?.querySelector('.card-title');
    if (title) title.textContent = 'Average Guesses';
  }
  
  // 4. Perfect Games (keep this one too)
  const perfectGamesElement = document.getElementById('stats-perfect-games');
  if (perfectGamesElement) {
    perfectGamesElement.textContent = stats.perfectGames || 0;
    const title = perfectGamesElement.closest('.card')?.querySelector('.card-title');
    if (title) title.textContent = 'Perfect Games';
  }
  
  // Add the new streak boxes to the stats container
  this.addStreakBoxes();
  
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

/**
 * Add streak stat boxes to the stats grid
 */
addStreakBoxes() {
  const statsRow = this.container.querySelector('.stats-content .row');
  if (!statsRow) return;
  
  // Create Current Streak box
  const currentStreakCol = document.createElement('div');
  currentStreakCol.className = 'col-6 mb-3';
  currentStreakCol.innerHTML = `
    <div class="stat-card card">
      <div class="card-body text-center card-current-streak">
        <h6 class="card-title">Current Streak</h6>
        <p class="mb-0" id="stats-current-streak">0</p>
      </div>
    </div>
  `;
  
  // Create Best Streak box
  const bestStreakCol = document.createElement('div');
  bestStreakCol.className = 'col-6 mb-3';
  bestStreakCol.innerHTML = `
    <div class="stat-card card">
      <div class="card-body text-center card-best-streak">
        <h6 class="card-title">Best Streak</h6>
        <p class="mb-0" id="stats-best-streak">0</p>
      </div>
    </div>
  `;
  
  // Add them to the stats row
  statsRow.appendChild(currentStreakCol);
  statsRow.appendChild(bestStreakCol);
}
}

export default UserStats;