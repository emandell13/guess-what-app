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
    this.answerGrid = new AnswerGrid("answer-boxes");
    this.scoreTracker = new ScoreTracker("current-score", "max-score");
    this.strikeCounter = new StrikeCounter("strikes", 3);
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
    
    // Use the VisualViewport API which is specifically designed for handling mobile keyboards
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', () => {
        // Update the form position based on visual viewport
        const guessForm = document.getElementById('guess-form-container');
        if (guessForm) {
          // Set the bottom position based on the viewport height difference
          const bottomOffset = window.innerHeight - window.visualViewport.height;
          guessForm.style.bottom = bottomOffset > 0 ? `${bottomOffset}px` : '0';
        }
      });
      
      // Reset when viewport changes orientation
      window.visualViewport.addEventListener('scroll', () => {
        const guessForm = document.getElementById('guess-form-container');
        if (guessForm && window.visualViewport.height === window.innerHeight) {
          guessForm.style.bottom = '0';
        }
      });
    }
    // Fallback for browsers without VisualViewport API - use the CSS variable approach
    else {
      // Set initial viewport height
      const setViewportHeight = () => {
        // First we get the viewport height and multiply it by 1% to get a value for a vh unit
        const vh = window.innerHeight * 0.01;
        // Then we set the value in the --vh custom property to the root of the document
        document.documentElement.style.setProperty('--vh', `${vh}px`);
      };
      
      // Set the height initially
      setViewportHeight();
      
      // Update the height on resize (with debounce for performance)
      let resizeTimeout;
      window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(setViewportHeight, 150);
      });
      
      // Handle iOS specific issues by listening for orientation changes
      window.addEventListener('orientationchange', () => {
        // Small timeout to wait for the resize to finish
        setTimeout(setViewportHeight, 200);
      });
      
      // Additional handling for input focus
      inputElement.addEventListener('focus', () => {
        // Delay scroll to allow keyboard to fully open
        setTimeout(() => {
          inputElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);
      });
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

  /**
   * Set up auth button click handler
   */
  setupAuthButton() {
    const authButton = document.getElementById('auth-button');
    if (authButton) {
      authButton.addEventListener('click', () => {
        this.authModal.showProfile();
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
    eventService.on('game:strike-added', (event) => {
      const { strikes } = event.detail;
      this.strikeCounter.updateStrikes(strikes, true);

      // If max strikes reached, reveal all remaining answers
      if (strikes >= 3) {
        this.revealAllRemainingAnswers();
      }
    });

    // Game completed events
    eventService.on('game:completed', (event) => {
      const { currentScore } = event.detail;

      // Show game complete modal
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

    // Listen for open voting modal events
    eventService.on('ui:open-voting-modal', () => {
      // Open the modal and go to voting step
      this.gameModal.modal.show();
      this.gameModal.currentStep = 1; // Set to 1 before calling nextStep
      this.gameModal.nextStep();
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
        eventService.emit('ui:open-voting-modal');
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
   */
  async revealAllRemainingAnswers() {
    try {
      const response = await fetch("/guesses/question?includeAnswers=true");
      const data = await response.json();

      // Filter out already guessed answers
      const remainingAnswers = data.answers.filter(answer =>
        !gameService.correctGuesses.some(guess => guess.rank === answer.rank)
      );

      // Reveal all remaining answers with staggered animations
      await this.answerGrid.revealAllRemaining(remainingAnswers);

      // Disable guess form after revealing all
      if (this.guessForm) this.guessForm.disable();
    } catch (error) {
      console.error('Error revealing remaining answers:', error);
    }
  }
}

// Application initialization
document.addEventListener("DOMContentLoaded", async () => {
  const app = new App();
  await app.initialize();
});