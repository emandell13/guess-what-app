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
   * @param {function} onCorrectGuess - Callback for when a correct guess is made
   * @param {function} onIncorrectGuess - Callback for when an incorrect guess is made
   * @param {function} onAlreadyGuessed - Callback for when an already guessed answer is submitted
   */
  constructor(formId, onCorrectGuess, onIncorrectGuess, onAlreadyGuessed) {
    this.form = document.getElementById(formId);
    this.input = this.form.querySelector('input');
    this.submitButton = this.form.querySelector('button');
    
    this.onCorrectGuess = onCorrectGuess;
    this.onIncorrectGuess = onIncorrectGuess;
    this.onAlreadyGuessed = onAlreadyGuessed;
    
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
        
        // Only save correct guesses that haven't been guessed before
        if (!recordResult.alreadyGuessed && authService.isAuthenticated()) {
          try {
            const saveResponse = await fetch("/user/save-guess", {
              method: "POST",
              headers: authService.getAuthHeaders(),
              body: JSON.stringify({
                question_id: gameService.question.id,
                guess_text: userGuess,
                is_correct: true,
                points_earned: result.points,
                matched_answer_id: result.answerId || null,
                current_score: gameService.currentScore,
                strikes: gameService.strikes
              })
            });
            
            console.log("Save guess response:", await saveResponse.json());
          } catch (error) {
            console.error("Error saving guess:", error);
          }
        }
        
        if (recordResult.alreadyGuessed) {
          // This answer was already guessed
          if (this.onAlreadyGuessed) {
            this.onAlreadyGuessed(result.canonicalAnswer || userGuess);
          }
        } else {
          // New correct guess
          if (this.onCorrectGuess) {
            this.onCorrectGuess(result.rank, userGuess, result.points, result.canonicalAnswer);
          }
        }
      } else {
        // Incorrect guess
        gameService.addStrike();
        
        // Always save incorrect guesses
        if (authService.isAuthenticated()) {
          try {
            const saveResponse = await fetch("/user/save-guess", {
              method: "POST",
              headers: authService.getAuthHeaders(),
              body: JSON.stringify({
                question_id: gameService.question.id,
                guess_text: userGuess,
                is_correct: false,
                points_earned: 0,
                matched_answer_id: null,
                current_score: gameService.currentScore,
                strikes: gameService.strikes
              })
            });
            
            console.log("Save guess response:", await saveResponse.json());
          } catch (error) {
            console.error("Error saving guess:", error);
          }
        }
        
        if (this.onIncorrectGuess) {
          this.onIncorrectGuess();
        }
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