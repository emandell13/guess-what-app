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
  }
  
  /**
   * Updates the displayed score
   * @param {number} currentScore - The current score
   * @param {number} maxScore - The maximum possible score
   */
  updateScore(currentScore, maxScore) {
    this.currentScoreElement.textContent = currentScore;
    this.maxScoreElement.textContent = maxScore;
  }
}

export default ScoreTracker;