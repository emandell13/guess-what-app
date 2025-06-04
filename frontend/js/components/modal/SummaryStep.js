// frontend/js/components/modal/SummaryStep.js

import eventService from '../../services/EventService.js';
import authService from '../../services/AuthService.js';
import gameService from '../../services/GameService.js';
import streakService from '../../services/StreakService.js';

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
    this.resultHeadingPerfect = this.stepElement.querySelector('#result-heading-perfect');
    this.streakIndicator = null; // Will be created dynamically

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
   * @param {number} totalGuesses - Total number of guesses made
   */
  updateHeading(gaveUp, correctAnswers, totalGuesses) {
    // Make sure we have the heading elements
    if (!this.resultHeading || !this.resultHeadingLose || !this.resultHeadingPerfect) {
      // Try to get them again, they might not have been available in constructor
      this.resultHeading = this.stepElement.querySelector('#result-heading');
      this.resultHeadingLose = this.stepElement.querySelector('#result-heading-lose');
      this.resultHeadingPerfect = this.stepElement.querySelector('#result-heading-perfect');
      
      if (!this.resultHeading || !this.resultHeadingLose) {
        console.error("Could not find heading elements");
        return;
      }
      
      // If perfect heading doesn't exist, create it
      if (!this.resultHeadingPerfect) {
        this.resultHeadingPerfect = document.createElement('h3');
        this.resultHeadingPerfect.id = 'result-heading-perfect';
        this.resultHeadingPerfect.className = 'text-center mb-4 d-none';
        this.resultHeadingPerfect.textContent = 'Perfect Game!';
        
        // Insert after other headings
        if (this.resultHeadingLose && this.resultHeadingLose.parentNode) {
          this.resultHeadingLose.parentNode.insertBefore(this.resultHeadingPerfect, this.resultHeadingLose.nextSibling);
        }
      }
    }
    
    // Check for perfect game - all 5 answers correct with exactly 5 guesses (no incorrect guesses)
    const isPerfectGame = correctAnswers && 
                         correctAnswers.length === 5 && 
                         totalGuesses === 5 && 
                         !gaveUp;
    
    const shouldShowLoseHeading = gaveUp === true || (correctAnswers && correctAnswers.length < 5);
    
    // Force direct DOM manipulation with try/catch for safety
    try {
      if (isPerfectGame) {
        // Perfect game - show "Perfect Game!"
        this.resultHeading.classList.add('d-none');
        this.resultHeadingLose.classList.add('d-none');
        this.resultHeadingPerfect.classList.remove('d-none');
        
        // Trigger perfect game celebration event
        eventService.emit('game:perfect-game');
      } else if (shouldShowLoseHeading) {
        // They lost or gave up - show "Better luck next time!"
        this.resultHeading.classList.add('d-none');
        this.resultHeadingLose.classList.remove('d-none');
        this.resultHeadingPerfect.classList.add('d-none');
      } else {
        // They won but not perfectly - show "You win!"
        this.resultHeading.classList.remove('d-none');
        this.resultHeadingLose.classList.add('d-none');
        this.resultHeadingPerfect.classList.add('d-none');
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
        
        if (this.resultHeadingPerfect) {
          this.resultHeadingPerfect.classList.add('d-none');
        }
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
      
      // Now update the heading separately with the totalGuesses parameter
      this.updateHeading(gaveUp, correctRanks, this.gameData.score);
    } catch (error) {
      console.error('Error getting game state:', error);
      
      // Even if there's an error, try to at least update the headings
      if (gaveUpParam === true) {
        this.updateHeading(true, [], 0);
      }
    }

    // Emit event when step is shown
    eventService.emit('summary:shown', {
      guessCount: this.gameData.score
    });

    // Create and show streak indicator (positioned below header)
    this.updateStreakIndicator(gaveUpParam || (gameService.gaveUp === true));

    // Handle stats link visibility based on auth status
    this.updateStatsLinkVisibility();
  }

  /**
   * Updates the stats link visibility - now always hidden since streak indicator replaces it
   */
  updateStatsLinkVisibility() {
    // Always hide stats link - streak indicator serves this purpose better
    if (this.statsLink) {
      this.statsLink.style.display = 'none';
    }
  }

  /**
   * Creates and updates the streak indicator based on auth status and game outcome
   */
  async updateStreakIndicator(gaveUp = false) {
    // Remove existing streak indicator if it exists
    if (this.streakIndicator) {
      this.streakIndicator.remove();
      this.streakIndicator = null;
    }

    // Create streak indicator element
    this.streakIndicator = document.createElement('div');
    this.streakIndicator.className = 'text-center mt-3 mb-3 streak-indicator';
    
    if (authService.isAuthenticated()) {
      // Authenticated users - show actual streak status
      await this.showAuthenticatedStreakStatus(gaveUp);
    } else {
      // Anonymous users - show signup prompt
      this.showAnonymousStreakPrompt(gaveUp);
    }

    // Insert streak indicator after the header (before score display)
    const scoreDisplay = this.stepElement.querySelector('.score-display');
    if (scoreDisplay && scoreDisplay.parentNode) {
      scoreDisplay.parentNode.insertBefore(this.streakIndicator, scoreDisplay);
    }
  }

  /**
   * Shows streak status for authenticated users
   */
  async showAuthenticatedStreakStatus(gaveUp) {
    try {
      const streakData = await streakService.getStreakInfo();
      const currentStreak = streakData?.current || 0;
      
      // Don't add to the streak - the backend has already updated it by now
      let displayStreak = currentStreak;
      
      let streakText = '';
      let streakClass = 'streak-indicator-auth';
      
      if (gaveUp || displayStreak === 0) {
        streakText = 'Streak reset. Start again tomorrow 🔥';
        streakClass += ' streak-reset';
      } else if (displayStreak <= 4) {
        streakText = `${displayStreak} day streak 🔥`;
        streakClass += ' streak-active';
      } else {
        streakText = `${displayStreak} day streak - keep it up! 🔥🔥`;
        streakClass += ' streak-milestone';
      }
      
      this.streakIndicator.textContent = streakText;
      this.streakIndicator.className += ` ${streakClass}`;
      
    } catch (error) {
      console.error('Error fetching streak for indicator:', error);
      // Fallback message
      this.streakIndicator.textContent = 'Great game! 🔥';
      this.streakIndicator.className += ' streak-indicator-auth';
    }
  }

  /**
   * Shows signup prompt for anonymous users
   */
  showAnonymousStreakPrompt(gaveUp) {
    let promptText = '';
    let streakClass = 'streak-indicator-anon';
    
    if (gaveUp) {
      promptText = 'Track your stats';
    } else {
      promptText = '1 day streak! Create an account to keep your streak alive 🔥';
    }
    
    this.streakIndicator.textContent = promptText;
    this.streakIndicator.className += ` ${streakClass}`;
    this.streakIndicator.style.cursor = 'pointer';
    this.streakIndicator.style.textDecoration = 'underline';
    
    // Add click handler to open registration modal
    this.streakIndicator.addEventListener('click', () => {
      eventService.emit('ui:open-register-modal');
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
}

export default SummaryStep;