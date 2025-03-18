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
    this.scoreElement = this.stepElement.querySelector('#modalFinalScore');
    this.nextButton = this.stepElement.querySelector('.btn-next');
    
    // Game state cache
    this.gameData = {
      score: 0
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
    
    // Update score with latest value when shown
    this.updateScore(this.gameData.score);
    
    // Emit event when step is shown
    eventService.emit('summary:shown', {
      score: this.gameData.score
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
  updateScore(score) {
    this.scoreElement.textContent = score;
    
    // Only emit update event if the element is visible
    if (this.stepElement.style.display !== 'none') {
      eventService.emit('summary:score-updated', {
        score: score,
        element: this.scoreElement.id
      });
    }
  }
}

export default SummaryStep;