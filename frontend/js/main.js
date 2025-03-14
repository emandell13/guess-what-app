// Import services
import gameService from './services/GameService.js';
import voteService from './services/VoteService.js';
import authService from './services/AuthService.js';
import visitorService from './services/VisitorService.js';

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

    // Initialize game service event handlers
    this.setupGameServiceCallbacks();

    // Setup auth button click handler
    this.setupAuthButton();
    
    // Register this visitor
    this.registerVisitor();
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
      document.addEventListener('user-login', () => this.updateAuthButton());
      document.addEventListener('user-logout', () => this.updateAuthButton());
    }
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
        // Just show the icon when authenticated
        authButton.innerHTML = `<i class="fas fa-user"></i>`;
        authButton.classList.remove('btn-outline-primary');
        authButton.classList.add('btn-primary');
      } else {
        // Just show the icon when not authenticated
        authButton.innerHTML = `<i class="fas fa-user"></i>`;
        authButton.classList.remove('btn-primary');
        authButton.classList.add('btn-outline-primary');  
      }
    }
  }
  
  /**
   * Set up callbacks for game service events
   */
  setupGameServiceCallbacks() {
    gameService.registerScoreChangeCallback(this.handleScoreChange.bind(this));
    gameService.registerStrikeAddedCallback(this.handleStrikeAdded.bind(this));
    gameService.registerGameCompleteCallback(this.handleGameComplete.bind(this));
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

    // Initialize guess form
    this.guessForm = new GuessForm(
      "guess-form",
      this.handleCorrectGuess.bind(this),
      this.handleIncorrectGuess.bind(this),
      this.handleAlreadyGuessed.bind(this)
    );
    
    // Check for verification parameter after everything is initialized
    this.checkVerificationStatus();
  }

  /**
   * Check if the URL contains a verification success parameter
   */
  checkVerificationStatus() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('verified') && urlParams.get('verified') === 'success') {
      console.log("Verification success detected, showing login modal");
      this.authModal.showLoginWithVerificationSuccess();
      
      // Clean up the URL (remove the query parameter)
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }

  /**
   * Update UI with initial game state
   */
  updateInitialUI(answerCount) {
    // Update question text
    this.questionHeading.textContent = gameService.getQuestionText();

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

  // Event handlers

  handleScoreChange(currentScore, maxScore) {
    this.scoreTracker.updateScore(currentScore, maxScore);
  }

  handleStrikeAdded(strikes) {
    this.strikeCounter.updateStrikes(strikes, true);

    // If max strikes reached, reveal all remaining answers
    if (strikes >= 3) {
      this.revealAllRemainingAnswers();
    }
  }

  handleGameComplete() {
    // Show game complete modal
    this.gameModal.show(gameService.currentScore);

    // Disable guess form
    if (this.guessForm) this.guessForm.disable();
  }

  handleCorrectGuess(rank, guess, points, canonicalAnswer) {
    this.answerGrid.revealAnswer(rank, guess, points, canonicalAnswer);
  }

  handleIncorrectGuess() {
    // No additional action needed as strike is already added via GameService
  }

  handleAlreadyGuessed(answer) {
    this.showAlreadyGuessedMessage(answer);
  }

  // Helper methods

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