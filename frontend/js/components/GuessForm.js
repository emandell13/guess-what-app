import gameService from '../services/GameService.js';
import guessService from '../services/GuessService.js';
import authService from '../services/AuthService.js';
import eventService from '../services/EventService.js';

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

    // Listen for clicks on the Give Up button
    const giveUpButton = document.getElementById('give-up-btn');
    if (giveUpButton) {
      giveUpButton.addEventListener("click", async (event) => {
        event.preventDefault();
        await this.handleGiveUp();
      });
    }

    // Tap on answer box focuses input
    const answerBoxes = document.getElementById("answer-boxes");
    if (answerBoxes) {
      answerBoxes.addEventListener("click", (event) => {
        const target = event.target.closest(".card-body");
        if (!target) return;
        this.input.focus();
        setTimeout(() => {
          this.input.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 300);
      });
    }

    // Scroll into view on mobile when focusing the input
    this.input.addEventListener("focus", () => {
      setTimeout(() => {
        this.input.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 300);
    });

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
    
    // Listen for game:completed event to disable the form
    eventService.on('game:completed', () => {
      this.disable();
      // Reset the Give Up button from loading state
      const giveUpButton = document.getElementById('give-up-btn');
      if (giveUpButton) {
        giveUpButton.disabled = true; // Keep disabled but reset appearance
        giveUpButton.textContent = 'Give Up';
      }
    });
    
    // Listen for game:gave-up event to reset and disable the form
    eventService.on('game:gave-up', () => {
      // Reset the button immediately when gave-up event fires
      const giveUpButton = document.getElementById('give-up-btn');
      if (giveUpButton) {
        giveUpButton.disabled = true; // Keep it disabled
        giveUpButton.textContent = 'Give Up'; // But reset the text
      }
      this.disable();
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
        // Record correct guess
        gameService.recordCorrectGuess(
          userGuess,
          result.rank,
          result.voteCount,
          result.canonicalAnswer
        );
      } else {
        // Record incorrect guess
        gameService.recordIncorrectGuess(userGuess);
      }
    } catch (error) {
      console.error("Error:", error);
    }

    // Reset form
    this.form.reset();
  }

  /**
   * Handles when the user gives up
   */
  async handleGiveUp() {
    // Check if game is already over before proceeding
    if (gameService.isGameOver()) {
      return;
    }
  
    // Get a reference to the Give Up button
    const giveUpButton = document.getElementById('give-up-btn');
    
    // Show confirmation dialog
    if (confirm("Are you sure you want to give up? All remaining answers will be revealed.")) {
      try {
        // Disable form during the request
        this.disableDuringRequest();
  
        // Call the give up endpoint
        const result = await gameService.giveUp();
  
        if (result.success) {
          // Form will be disabled via the game:gave-up event
          console.log("Successfully gave up, remaining answers:", result.answers);
        } else {
          // Re-enable form if there was an error
          this.enable();
          console.error("Error giving up:", result.error);
        }
      } catch (error) {
        // Re-enable form if there was an error
        this.enable();
        console.error("Error giving up:", error);
      }
    } else {
      // User canceled - reset the button state
      if (giveUpButton) {
        giveUpButton.disabled = false;
        giveUpButton.textContent = 'Give Up';
      }
    }
  }

  /**
   * Disables the form temporarily during a request
   */
  disableDuringRequest() {
    this.input.disabled = true;
    this.submitButton.disabled = true;
    
    const giveUpButton = document.getElementById('give-up-btn');
    if (giveUpButton) {
      giveUpButton.disabled = true;
      giveUpButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Loading...';
    }
  }
  
  /**
   * Disables the form
   */
  disable() {
    this.input.disabled = true;
    this.submitButton.disabled = true;
    
    const giveUpButton = document.getElementById('give-up-btn');
    if (giveUpButton) {
      giveUpButton.disabled = true;
    }
  }
  
  /**
   * Enables the form
   */
  enable() {
    this.input.disabled = false;
    this.submitButton.disabled = false;
    
    const giveUpButton = document.getElementById('give-up-btn');
    if (giveUpButton) {
      giveUpButton.disabled = false;
      giveUpButton.textContent = 'Give Up';
    }
  }  
}

export default GuessForm;