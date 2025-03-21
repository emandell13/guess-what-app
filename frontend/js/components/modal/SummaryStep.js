// frontend/js/components/modal/SummaryStep.js

import eventService from '../../services/EventService.js';

/**
 * Component representing the summary step of the game completion modal
 */
class SummaryStep {
  /**
   * Creates a new SummaryStep
   * @param {string} stepId - The ID of the step element
   */
  constructor(stepId) {
    this.stepElement = document.getElementById(stepId);
    this.tensDigitElement = this.stepElement.querySelector('#modalScoreTens');
    this.onesDigitElement = this.stepElement.querySelector('#modalScoreOnes');
    this.pointsTotalElement = this.stepElement.querySelector('#modalPointsTotal');
    this.nextButton = this.stepElement.querySelector('.btn-next');
    
    // Game state cache
    this.gameData = {
      score: 0,
      maxPoints: 0
    };
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Set up UI event listener
    this.nextButton.addEventListener('click', () => {
      // Emit an event when next button is clicked
      eventService.emit('modal:next-step', {
        currentStep: 'summary',
        nextStep: 'vote'
      });
    });
  }

  /**
   * Sets up event listeners for game events
   */
  setupEventListeners() {
    // Listen for score changes
    eventService.on('game:score-change', (event) => {
      const { currentScore } = event.detail;
      this.gameData.score = currentScore;
      this.updateScore(currentScore);
    });
    
    // Listen for game completed event
    eventService.on('game:completed', (event) => {
      const { currentScore } = event.detail;
      this.gameData.score = currentScore;
      this.updateScore(currentScore);
      
      // Emit event that summary is ready
      eventService.emit('summary:ready', {
        score: currentScore
      });
    });
  }
  
  /**
   * Shows this step
   */
  show() {
    this.stepElement.style.display = 'block';
    
    // Get the latest game score information
    // This handles the case where the page is reloaded and no events are fired
    try {
      const gameService = window.app ? window.app.gameService : null;
      if (gameService) {
        this.gameData.score = gameService.currentScore || 0;
        this.gameData.maxPoints = gameService.maxPoints || 0;
      } else {
        // Fallback if gameService isn't accessible
        // Try to get data from the DOM if available
        const currentScoreElement = document.getElementById('current-score');
        const maxScoreElement = document.getElementById('max-score');
        if (currentScoreElement) {
          this.gameData.score = parseInt(currentScoreElement.textContent) || 0;
        }
        if (maxScoreElement) {
          this.gameData.maxPoints = parseInt(maxScoreElement.textContent) || 0;
        }
      }
    } catch (error) {
      console.error('Error getting game state:', error);
    }
    
    // Update score with latest value when shown
    this.updateScore(this.gameData.score, this.gameData.maxPoints);
    
    // Emit event when step is shown
    eventService.emit('summary:shown', {
      score: this.gameData.score,
      maxPoints: this.gameData.maxPoints
    });
  }
  
  /**
   * Hides this step
   */
  hide() {
    this.stepElement.style.display = 'none';
    
    // Emit event when step is hidden
    eventService.emit('summary:hidden');
  }
  
  /**
   * Updates the score displayed
   * @param {number} score - The score to display
   */
  updateScore(score, maxPoints) {
    this.gameData.score = score;
    this.gameData.maxPoints = maxPoints || this.gameData.maxPoints;
    
    // Split the score into digits
    const scoreStr = score.toString().padStart(2, '0');
    const tensDigit = scoreStr.length > 1 ? scoreStr[scoreStr.length - 2] : '0';
    const onesDigit = scoreStr[scoreStr.length - 1];
    
    this.tensDigitElement.textContent = tensDigit;
    this.onesDigitElement.textContent = onesDigit;
    this.pointsTotalElement.textContent = this.gameData.maxPoints;
    
    // Only emit update event if the element is visible
    if (this.stepElement.style.display !== 'none') {
      eventService.emit('summary:score-updated', {
        score: score,
        maxPoints: this.gameData.maxPoints
      });
    }
  }  
}

export default SummaryStep;