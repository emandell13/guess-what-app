import eventService from '../../services/EventService.js';
import authService from '../../services/AuthService.js';

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
    this.hundredsDigitElement = this.stepElement.querySelector('#modalScoreHundreds');
    this.tensDigitElement = this.stepElement.querySelector('#modalScoreTens');
    this.onesDigitElement = this.stepElement.querySelector('#modalScoreOnes');
    this.pointsTotalElement = this.stepElement.querySelector('#modalPointsTotal');
    this.nextButton = this.stepElement.querySelector('.btn-next');
    this.statsLink = this.stepElement.querySelector('.stats-link');

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

    if (this.statsLink) {
      if (authService.isAuthenticated()) {
        this.statsLink.style.display = 'none';
      } else {
        this.statsLink.style.display = 'inline-block';

        // Add click handler if not already added
        if (!this.statsLink.hasClickHandler) {
          this.statsLink.addEventListener('click', (e) => {
            e.preventDefault();
            // Emit an event to open the login modal
            eventService.emit('ui:open-login-modal');
          });
          this.statsLink.hasClickHandler = true;
        }
      }
    }

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

    // Get the parent element of the digit boxes (container for all score boxes)
    const scoreBoxesContainer = this.onesDigitElement.closest('.score-boxes');
    const hundredsDigitBox = this.hundredsDigitElement?.closest('.hundreds-digit-box');
    const tensDigitBox = this.tensDigitElement?.closest('.tens-digit-box');


    // Remove all digit-related classes
    if (scoreBoxesContainer) {
      scoreBoxesContainer.classList.remove('single-digit', 'double-digit', 'triple-digit');
    }

    // Split the score into digits and update display
    if (score >= 100) {
      // Triple digit scenario
      if (scoreBoxesContainer) scoreBoxesContainer.classList.add('triple-digit');
      if (hundredsDigitBox) hundredsDigitBox.style.display = 'flex';

      const scoreStr = score.toString();
      this.hundredsDigitElement.textContent = scoreStr[0];
      this.tensDigitElement.textContent = scoreStr[1];
      this.onesDigitElement.textContent = scoreStr[2];
    } else if (score >= 10) {
      
      // Double digit scenario
      if (scoreBoxesContainer) scoreBoxesContainer.classList.add('double-digit');
      if (hundredsDigitBox) hundredsDigitBox.style.display = 'none';
      if (tensDigitBox) tensDigitBox.style.display = 'flex'; // Make sure tens digit is visible

      const scoreStr = score.toString();
      this.tensDigitElement.textContent = scoreStr[0];
      this.onesDigitElement.textContent = scoreStr[1];
    } else {
      // Single digit scenario
      if (scoreBoxesContainer) scoreBoxesContainer.classList.add('single-digit');
      if (hundredsDigitBox) hundredsDigitBox.style.display = 'none';
      if (tensDigitBox) tensDigitBox.style.display = 'none';

      this.onesDigitElement.textContent = score.toString();
    }

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