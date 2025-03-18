import gameService from '../services/GameService.js';
import guessService from '../services/GuessService.js';
import authService from '../services/AuthService.js';

/**
 * Component representing the form for submitting guesses
 */
class GuessForm {
  /**
   * Creates a new GuessForm
   * @param {string} formId - The ID of the form element
   */
  constructor(formId) {
    this.form = document.getElementById(formId);
    this.input = this.form.querySelector('input');
    this.submitButton = this.form.querySelector('button');
    
    this.setupEventListeners();
  }
  
  /**
   * Sets up event listeners for the form
   */
  setupEventListeners() {
    this.form.addEventListener("submit", async (event) => {
      event.preventDefault();
      await this.handleGuess();
    });
  }
  
  /**
   * Handles when a guess is submitted
   */
  async handleGuess() {
    // Check if game is already over before proceeding
    if (gameService.isGameOver()) {
      return;
    }
    
    const userGuess = this.input.value.trim();
    if (!userGuess) return;  // Don't submit empty guesses
    
    try {
      const result = await guessService.submitGuess(userGuess);
      
      if (result.isCorrect) {
        const recordResult = gameService.recordCorrectGuess(
          userGuess,
          result.rank,
          result.points,
          result.canonicalAnswer
        );
      } else {
        // Incorrect guess - addStrike will emit the event
        gameService.addStrike();
      }
    } catch (error) {
      console.error("Error:", error);
    }
    
    // Reset form
    this.form.reset();
  }
  
  /**
   * Disables the form
   */
  disable() {
    this.input.disabled = true;
    this.submitButton.disabled = true;
  }
  
  /**
   * Enables the form
   */
  enable() {
    this.input.disabled = false;
    this.submitButton.disabled = false;
  }
}

export default GuessForm;