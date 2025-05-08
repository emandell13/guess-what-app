import eventService from '../../services/EventService.js';
import authService from '../../services/AuthService.js';
import gameService from '../../services/GameService.js';

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
    this.onesDigitElement = this.stepElement.querySelector('#modalScoreOnes');
    this.pointsTotalElement = this.stepElement.querySelector('.score-text');
    this.nextButton = this.stepElement.querySelector('.btn-next');
    this.statsLink = this.stepElement.querySelector('.stats-link');
    this.resultHeading = this.stepElement.querySelector('#result-heading');
    this.resultHeadingLose = this.stepElement.querySelector('#result-heading-lose');

    // Game state cache
    this.gameData = {
      score: 0,
      correctAnswers: []
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
    // Listen for guess counter updates
    eventService.on('game:guess-counter-updated', (event) => {
      const { totalGuesses } = event.detail;
      if (totalGuesses !== undefined) {
        this.gameData.score = totalGuesses;
      }
    });

    // Listen for answers revealed
    eventService.on('game:answer-revealed', (event) => {
      const { rank } = event.detail;

      // Store the revealed answer rank
      if (!this.gameData.correctAnswers.includes(rank)) {
        this.gameData.correctAnswers.push(rank);
      }
    });

    // Listen for game completed event
    eventService.on('game:completed', (event) => {
      // Add defensive check here
      if (event.detail && event.detail.totalGuesses !== undefined) {
        this.gameData.score = event.detail.totalGuesses;
      }

      // Emit event that summary is ready
      eventService.emit('summary:ready', {
        score: this.gameData.score || 0
      });
    });
  }

  /**
   * Updates the answer boxes display - only handles styling the answer boxes
   * @param {Array} correctAnswers - Array of ranks of correct answers
   * @param {boolean} gaveUp - Whether the user gave up
   */
  updateAnswerBoxes(correctAnswers, gaveUp) {
    // Get all answer boxes
    const answerBoxes = this.stepElement.querySelectorAll('.answer-box');

    // Reset all boxes first
    answerBoxes.forEach(box => {
      box.classList.remove('correct', 'incorrect');
    });

    // Mark correct ones with green
    if (correctAnswers && correctAnswers.length > 0) {
      correctAnswers.forEach(rank => {
        const box = this.stepElement.querySelector(`.answer-box[data-rank="${rank}"]`);
        if (box) {
          box.classList.add('correct');
        }
      });
    }

    // If the user gave up, mark the remaining ones as incorrect/red
    if (gaveUp) {
      answerBoxes.forEach(box => {
        if (!box.classList.contains('correct')) {
          box.classList.add('incorrect');
        }
      });
    }
  }
  
  /**
   * Updates the heading display based on game state
   * @param {boolean} gaveUp - Whether the user gave up
   * @param {Array} correctAnswers - Array of ranks of correct answers
   */
  updateHeading(gaveUp, correctAnswers) {
    // Make sure we have the heading elements
    if (!this.resultHeading || !this.resultHeadingLose) {
      // Try to get them again, they might not have been available in constructor
      this.resultHeading = this.stepElement.querySelector('#result-heading');
      this.resultHeadingLose = this.stepElement.querySelector('#result-heading-lose');
      
      if (!this.resultHeading || !this.resultHeadingLose) {
        console.error("Could not find heading elements");
        return;
      }
    }
    
    const shouldShowLoseHeading = gaveUp === true || (correctAnswers && correctAnswers.length < 5);
    
    // Force direct DOM manipulation with try/catch for safety
    try {
      if (shouldShowLoseHeading) {
        // They lost or gave up - show "Better luck next time!"
        this.resultHeading.classList.add('d-none');
        this.resultHeadingLose.classList.remove('d-none');
      } else {
        // They won! - show "You win!"
        this.resultHeading.classList.remove('d-none');
        this.resultHeadingLose.classList.add('d-none');
      }
    } catch (error) {
      console.error("Error toggling headings:", error);
    }
  }

  /**
   * Updates the guess counter display
   * @param {number} guessCount - Number of guesses to display
   */
  updateScore(guessCount) {
    // Ensure guessCount is a valid number
    const totalGuesses = typeof guessCount === 'number' ? guessCount : 0;

    this.gameData.score = totalGuesses;

    // Simply update the one-digit box with the number of guesses
    if (this.onesDigitElement) {
      this.onesDigitElement.textContent = totalGuesses.toString();
    }

    // Update the text to say "Guesses" instead of points
    if (this.pointsTotalElement) {
      this.pointsTotalElement.textContent = "Guesses";
    }

    // Emit update event if the element is visible
    if (this.stepElement && this.stepElement.style.display !== 'none') {
      eventService.emit('summary:score-updated', {
        guessCount: totalGuesses
      });
    }
  }

  /**
   * Shows this step
   */
  show(forcedGaveUp) {
    this.stepElement.style.display = 'block';

    // Ensure we interpret forcedGaveUp as a boolean
    const gaveUpParam = forcedGaveUp === true;

    // CRITICAL: DIRECTLY SET HEADINGS HERE FIRST BASED ON FORCED GAVE UP
    // This ensures the headings are set immediately without depending on gameService
    if (gaveUpParam === true) {
      if (this.resultHeading && this.resultHeadingLose) {
        this.resultHeading.classList.add('d-none');
        this.resultHeadingLose.classList.remove('d-none'); 
      }
    }

    // Get the latest game info directly from gameService
    try {
      // Get basic info
      this.gameData.score = gameService.totalGuesses || 0;

      // Get correct answers
      const correctRanks = gameService.correctGuesses.map(guess => guess.rank);

      // Update the guess counter display
      this.updateScore(this.gameData.score);

      // Use either the forced gaveUp parameter or the game service value
      const gaveUp = gaveUpParam || (gameService.gaveUp === true);

      // Update the answer boxes
      this.updateAnswerBoxes(correctRanks, gaveUp);
      
      // Now update the heading separately
      this.updateHeading(gaveUp, correctRanks);
    } catch (error) {
      console.error('Error getting game state:', error);
      
      // Even if there's an error, try to at least update the headings
      if (gaveUpParam === true) {
        this.updateHeading(true, []);
      }
    }

    // Emit event when step is shown
    eventService.emit('summary:shown', {
      guessCount: this.gameData.score
    });

    // Handle stats link visibility
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
}

export default SummaryStep;