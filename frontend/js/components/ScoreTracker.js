import eventService from '../services/EventService.js';

/**
 * Component representing the score display
 */
class ScoreTracker {
  /**
   * Creates a new ScoreTracker
   * @param {string} currentScoreId - The ID of the current score element
   * @param {string} maxScoreId - The ID of the max score element
   */
  constructor(currentScoreId, maxScoreId) {
    this.currentScoreElement = document.getElementById(currentScoreId);
    this.maxScoreElement = document.getElementById(maxScoreId);
    
    // Initialize max score as 100
    if (this.maxScoreElement) {
      this.maxScoreElement.textContent = '100';
    }
    
    // Listen for score change events
    eventService.on('game:score-change', (event) => {
      const { currentScore } = event.detail;
      this.updateScore(currentScore, 100); // Always use 100 as maxScore
    });
  }
  
  /**
   * Updates the displayed score
   * @param {number} currentScore - The current score
   * @param {number} maxScore - The maximum possible score (always 100 now)
   */
  updateScore(currentScore, maxScore = 100) {
    if (this.currentScoreElement) {
      this.currentScoreElement.textContent = currentScore;
    }
    
    // Always ensure max score is 100
    if (this.maxScoreElement) {
      this.maxScoreElement.textContent = maxScore;
    }
  }
}

export default ScoreTracker;