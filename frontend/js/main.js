// Import services
import gameService from './services/GameService.js';
import voteService from './services/VoteService.js';
import authService from './services/AuthService.js';
import visitorService from './services/VisitorService.js';
import eventService from './services/EventService.js';

// Import components
import AnswerGrid from './components/AnswerGrid.js';
import GuessForm from './components/GuessForm.js';
import ScoreTracker from './components/ScoreTracker.js';
import StrikeCounter from './components/StrikeCounter.js';
import GameModal from './components/modal/GameModal.js';
import AuthModal from './components/modal/AuthModal.js';

/**
 * Main application class
 */
class App {
  constructor() {
    // Initialize components
    this.isGameOverModalPending = false;
    this.answerGrid = new AnswerGrid("answer-boxes");
    this.scoreTracker = new ScoreTracker("current-score", "max-score");
    this.strikeCounter = new StrikeCounter("strikes", 5);
    this.gameModal = new GameModal("gameCompleteModal");
    this.authModal = new AuthModal();
    this.questionHeading = document.querySelector("h2");

    // Setup event listeners
    this.setupEventListeners();

    // Setup auth button click handler
    this.setupAuthButton();

    // Setup mobile keyboard handling
    this.setupMobileKeyboardHandling();

    // Register this visitor
    this.registerVisitor();
  }

  /**
   * Setup mobile keyboard handling with VisualViewport API and fallbacks
   */
  setupMobileKeyboardHandling() {
    // Only apply on mobile devices
    if (!window.matchMedia('(max-width: 767.98px)').matches) {
      return;
    }
  
    // Get input element
    const inputElement = document.querySelector('#guess-form input');
    if (!inputElement) return;
    
    // Add focus handling for smooth scrolling to input
    inputElement.addEventListener('focus', () => {
      setTimeout(() => {
        inputElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    });
  
    // Use the VisualViewport API to handle keyboard position
    if (window.visualViewport) {
      const guessForm = document.getElementById('guess-form-container');
      if (!guessForm) return;
      
      // Efficient viewport handler with debouncing
      let vpTimeout;
      const updatePosition = () => {
        const offset = window.innerHeight - window.visualViewport.height - window.visualViewport.offsetTop;
        guessForm.style.transform = offset > 0 ? `translateY(-${offset}px)` : 'translateY(0)';
      };
      
      const handleViewportChange = () => {
        clearTimeout(vpTimeout);
        vpTimeout = setTimeout(updatePosition, 10);
      };
  
      // Add event listeners for viewport changes
      window.visualViewport.addEventListener("resize", handleViewportChange);
      window.visualViewport.addEventListener("scroll", handleViewportChange);
    }
  
    // Add padding to prevent content from being hidden behind the form on mobile
    const content = document.querySelector('.container');
    if (content) {
      content.style.paddingBottom = '4.5rem'; // Match the form container height
    }
  }  

  /**
   * Register the current visitor
   */
  async registerVisitor() {
    try {
      await visitorService.registerVisitor();
    } catch (error) {
      console.error("Error registering visitor:", error);
      // Silent failure - don't interrupt the app initialization
    }
  }

  setupAuthButton() {
    const authButton = document.getElementById('auth-button');
    if (authButton) {
      authButton.addEventListener('click', () => {
        // Check if the user is authenticated
        if (authService.isAuthenticated()) {
          this.authModal.showProfile();
        } else {
          this.authModal.showLogin();
        }
      });

      // Update button text based on auth state
      this.updateAuthButton();

      // Listen for auth state changes
      eventService.on('auth:login', () => this.updateAuthButton());
      eventService.on('auth:logout', () => this.updateAuthButton());
    }
  }

  /**
   * Set up event listeners for game events
   */
  setupEventListeners() {
    // Score change events
    eventService.on('game:score-change', (event) => {
      const { currentScore, maxPoints } = event.detail;
      this.scoreTracker.updateScore(currentScore, maxPoints);
    });

    // Strike added events
    eventService.on('game:strike-added', async (event) => {
      const { strikes } = event.detail;
      this.strikeCounter.updateStrikes(strikes, true);

      // If max strikes reached, reveal all remaining answers
      if (strikes >= 5) {
        console.log("Max strikes reached, disabling form and revealing answers");

        // Disable form immediately
        if (this.guessForm) this.guessForm.disable();

        // Signal that animations are in progress
        document.body.dataset.revealingAnswers = 'true';

        try {
          // Wait for all reveals to complete
          await this.revealAllRemainingAnswers();
          console.log("All answers revealed, showing modal");

          // Clear the flag - animations complete
          document.body.dataset.revealingAnswers = 'false';

          // Show the modal with the pending score (if game completed)
          if (this.gameModal.pendingScore !== undefined) {
            this.gameModal.show(this.gameModal.pendingScore);
            this.gameModal.pendingScore = undefined;
          }
        } catch (error) {
          console.error("Error in strike-out sequence:", error);
          // Clean up in case of error
          document.body.dataset.revealingAnswers = 'false';

          // Show modal anyway if there was an error and game completed
          if (this.gameModal.pendingScore !== undefined) {
            this.gameModal.show(this.gameModal.pendingScore);
            this.gameModal.pendingScore = undefined;
          }
        }
      }
    });

    // Game completed events
    eventService.on('game:completed', (event) => {
      const { currentScore } = event.detail;

      // Check if we're in the middle of a strike-reveal sequence
      if (this.isGameOverModalPending) {
        console.log("game:completed event received but modal pending - not showing yet");
        // Don't show the modal yet - the strike handler will do it after reveals
        return;
      }

      // Show game complete modal for normal completion
      console.log("game:completed event showing modal");
      this.gameModal.show(currentScore);

      // Disable guess form
      if (this.guessForm) this.guessForm.disable();
    });

    // Answer revealed events
    eventService.on('game:answer-revealed', (event) => {
      const { guess, rank, points, canonicalAnswer } = event.detail;
      this.answerGrid.revealAnswer(rank, guess, points, canonicalAnswer);
    });

    // Already guessed events
    eventService.on('game:already-guessed', (event) => {
      const { guess } = event.detail;
      this.showAlreadyGuessedMessage(guess);
    });

    // Listen for open login modal events
    eventService.on('ui:open-login-modal', () => {
      // Close the game modal first if it's open
      if (this.gameModal) {
        const modalElement = document.getElementById('gameCompleteModal');
        const bsModal = bootstrap.Modal.getInstance(modalElement);
        if (bsModal) {
          bsModal.hide();
        }
      }

      // Then show the login modal
      setTimeout(() => {
        if (this.authModal) {
          this.authModal.showLogin();
        }
      }, 400); // Short delay to allow the game modal to close
    });

    eventService.on('ui:open-voting-modal', (event) => {
      const isDirect = event?.detail?.direct || false;

      // Open the modal and go to voting step
      if (this.gameModal) {
        // If direct access, hide the progress bar and adjust close button
        // If direct access, replace progress bar with placeholder but keep layout intact
        if (isDirect) {
          const progressContainer = document.querySelector('#gameCompleteModal .progress-container');

          if (progressContainer) {
            // Instead of hiding it, replace its content with an invisible placeholder of same height
            progressContainer.innerHTML = '<div style="height: 1.25rem;"></div>';
          }
        }

        this.gameModal.modal.show();

        // If direct access, go directly to voting step (skip summary)
        if (isDirect) {
          this.gameModal.goToVotingStep();
        } else {
          // Normal flow - go to summary first
          this.gameModal.currentStep = 1; // Set to 1 before calling nextStep
          this.gameModal.nextStep();
        }
      }
    });


  }

  checkVerificationStatus() {
    // Only check for our custom verified parameter
    const urlParams = new URLSearchParams(window.location.search);

    if (urlParams.has('verified') && urlParams.get('verified') === 'success') {
      console.log("Verification success detected, showing login modal");
      this.authModal.showLoginWithVerificationSuccess();

      // Clean up the URL
      window.history.replaceState({}, document.title, window.location.pathname);
      return true;
    }

    return false;
  }

  /**
   * Update auth button text based on authentication state
   */
  async updateAuthButton() {
    const authButton = document.getElementById('auth-button');
    const isAuthenticated = authService.isAuthenticated();

    if (authButton) {
      if (isAuthenticated) {
        // Use Material Design icon when authenticated
        authButton.innerHTML = `<span class="material-icons">person</span>`;
      } else {
        // Use Material Design icon when not authenticated
        authButton.innerHTML = `<span class="material-icons">person</span>`;
      }
    }
  }

  /**
   * Initialize the application
   */
  async initialize() {
    // Initialize game
    const gameInitResult = await gameService.initialize();

    // Update the UI with initial game state
    if (gameInitResult.success) {
      this.updateInitialUI(gameInitResult.answerCount);
    } else {
      // No active question available
      this.questionHeading.textContent = "No question available for guessing yet";
    }

    // Fetch tomorrow's question for voting
    await voteService.fetchTomorrowsQuestion();

    // Initialize guess form - using the new event-based system
    this.guessForm = new GuessForm("guess-form");

    // Check for verification parameter after everything is initialized
    this.checkVerificationStatus();
  }

  /**
   * Update UI with initial game state
   */
  updateInitialUI(answerCount) {
    this.questionHeading.innerHTML = gameService.getQuestionText();

    // Add click event listener to the people count element
    const peopleCountElement = document.getElementById('people-count');
    if (peopleCountElement) {
      peopleCountElement.addEventListener('click', () => {
        // Emit an event to open the voting modal
        eventService.emit('ui:open-voting-modal', { direct: true });
      });
    }

    // Create answer boxes
    this.answerGrid.initialize(answerCount);

    // Update score display
    this.scoreTracker.updateScore(gameService.currentScore, gameService.maxPoints);

    // Update strikes display
    this.strikeCounter.updateStrikes(gameService.strikes, false);

    // If game is already restored as complete, handle accordingly
    if (gameService.isGameOver()) {
      console.log("Game is already over, showing completion modal");

      // If strikes maxed out, reveal all remaining answers
      if (gameService.strikes >= 3) {
        this.revealAllRemainingAnswers();
      }

      // Disable form and show modal after a short delay
      setTimeout(() => {
        if (this.guessForm) this.guessForm.disable();
        this.gameModal.show(gameService.currentScore);
      }, 500);
    }

    // For any already guessed answers, reveal them in the UI
    gameService.correctGuesses.forEach(guess => {
      this.answerGrid.revealAnswer(guess.rank, guess.guess, guess.points, guess.guess);
    });
  }

  /**
   * Shows a temporary message when an answer was already guessed
   */
  showAlreadyGuessedMessage(answer) {
    // Create a temporary message
    const messageContainer = document.createElement("div");
    messageContainer.className = "alert alert-warning already-guessed-alert";
    messageContainer.style.position = "fixed";
    messageContainer.style.top = "20px";
    messageContainer.style.left = "50%";
    messageContainer.style.transform = "translateX(-50%)";
    messageContainer.style.zIndex = "1050";
    messageContainer.style.padding = "10px 20px";
    messageContainer.style.borderRadius = "5px";
    messageContainer.style.boxShadow = "0 4px 8px rgba(0,0,0,0.1)";
    messageContainer.textContent = `You've already guessed "${answer}"!`;

    // Add to the body
    document.body.appendChild(messageContainer);

    // Remove after a delay
    setTimeout(() => {
      messageContainer.style.opacity = "0";
      messageContainer.style.transition = "opacity 0.5s ease";
      setTimeout(() => document.body.removeChild(messageContainer), 500);
    }, 2000);
  }

  /**
 * Reveals all remaining answers when the game is over
 * @returns {Promise} A promise that resolves when all answers are revealed
 */
  async revealAllRemainingAnswers() {
    try {
      console.log("Starting reveal of remaining answers");
      const response = await fetch("/guesses/question?includeAnswers=true");
      const data = await response.json();

      // Filter out already guessed answers
      const remainingAnswers = data.answers.filter(answer =>
        !gameService.correctGuesses.some(guess => guess.rank === answer.rank)
      );

      console.log(`Revealing ${remainingAnswers.length} remaining answers`);

      // Reveal all remaining answers with staggered animations
      const promise = this.answerGrid.revealAllRemaining(remainingAnswers);

      // Add these debug logs
      promise.then(() => {
        console.log("All answers revealed successfully");
      }).catch(err => {
        console.error("Error in reveal animation promise:", err);
      });

      return promise;
    } catch (error) {
      console.error('Error revealing remaining answers:', error);
      return Promise.resolve(); // Return a resolved promise on error
    }
  }
}

// Application initialization
document.addEventListener("DOMContentLoaded", async () => {
  const app = new App();
  await app.initialize();
});