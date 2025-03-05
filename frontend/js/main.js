// Import services
import gameService from './services/GameService.js';
import voteService from './services/VoteService.js';

// Import components
import AnswerGrid from './components/AnswerGrid.js';
import GuessForm from './components/GuessForm.js';
import ScoreTracker from './components/ScoreTracker.js';
import StrikeCounter from './components/StrikeCounter.js';
import GameModal from './components/modal/GameModal.js';

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
    this.questionHeading = document.querySelector("h2");
    
    // Initialize game service event handlers
    this.setupGameServiceCallbacks();
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