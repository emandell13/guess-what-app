import { saveTodayGuesses, getTodayGuesses, markTodayCompleted, saveTodayStrikes, getTodayStrikes } from '../utils/sessionUtils.js';

/**
 * Service that manages game state and logic
 */
class GameService {
  constructor() {
    // Game state
    this.correctGuesses = [];
    this.maxPoints = 0;
    this.currentScore = 0;
    this.strikes = 0;
    this.MAX_STRIKES = 3;
    this.question = null;
    this.answerCount = 5; // Default
    
    // Event callback storage
    this.onScoreChange = null;
    this.onStrikeAdded = null;
    this.onGameComplete = null;
  }
  
  /**
   * Initializes the game by fetching question data and restoring saved state
   */
  async initialize() {
    await this.fetchTodaysQuestion();
    this.restoreGameState();
    return {
      success: !!this.question,
      answerCount: this.answerCount
    };
  }
  
  /**
   * Fetches today's question data from the API
   */
  async fetchTodaysQuestion() {
    try {
      const response = await fetch("/guesses/question");
      const data = await response.json();
      
      if (data.question) {
        this.question = data;
        this.maxPoints = data.maxPoints;
        this.answerCount = data.answerCount || 5;
        return true;
      }
      return false;
    } catch (error) {
      console.error("Error fetching today's question:", error);
      return false;
    }
  }
  
  /**
   * Loads any previously saved guesses for today
   */
  restoreGameState() {
    // Load saved guesses
    const savedGuesses = getTodayGuesses();
    
    if (savedGuesses && savedGuesses.length > 0) {
      // Restore saved guesses
      this.correctGuesses = savedGuesses;
      
      // Calculate restored score
      this.currentScore = savedGuesses.reduce((sum, guess) => sum + (guess.points || 0), 0);
    }
    
    // Load saved strikes
    const savedStrikes = getTodayStrikes();
    if (savedStrikes > 0) {
      // Restore strikes count
      this.strikes = savedStrikes;
    }
  }
  
  /**
   * Records a correct guess
   */
  recordCorrectGuess(guess, rank, points, canonicalAnswer) {
    // Check if this rank has already been guessed
    const alreadyGuessed = this.correctGuesses.some(g => g.rank === rank);
    
    // If already guessed, return false (not a new correct guess)
    if (alreadyGuessed) {
      return { 
        success: false, 
        alreadyGuessed: true 
      };
    }
    
    // Update score
    this.updateScore(points);
    
    // Add the guess with points information
    const guessInfo = {
      guess: canonicalAnswer || guess,
      rank,
      points
    };
    
    this.correctGuesses.push(guessInfo);
    
    // Save progress
    saveTodayGuesses(this.correctGuesses);
    
    // Check if game is complete
    const gameComplete = this.isGameOver();
    
    if (gameComplete) {
      markTodayCompleted();
      if (this.onGameComplete) this.onGameComplete();
    }
    
    return { 
      success: true,
      gameComplete
    };
  }
  
  /**
   * Adds a strike to the game
   */
  addStrike() {
    this.strikes++;
    
    // Save strikes to session storage
    saveTodayStrikes(this.strikes);
    
    // Trigger callback if provided
    if (this.onStrikeAdded) {
      this.onStrikeAdded(this.strikes);
    }
    
    const maxStrikesReached = this.strikes >= this.MAX_STRIKES;
    
    // Mark game as completed if max strikes reached
    if (maxStrikesReached) {
      markTodayCompleted();
      if (this.onGameComplete) this.onGameComplete();
    }
    
    return maxStrikesReached;
  }
  
  /**
   * Updates the current score
   */
  updateScore(points) {
    this.currentScore += points;
    
    // Trigger callback if provided
    if (this.onScoreChange) {
      this.onScoreChange(this.currentScore, this.maxPoints);
    }
  }
  
  /**
   * Checks if the game is over
   */
  isGameOver() {
    // Game is over if MAX_STRIKES reached or all answers are found
    const allAnswersFound = this.correctGuesses.length >= this.answerCount;
    const struckOut = this.strikes >= this.MAX_STRIKES;
    
    return struckOut || allAnswersFound;
  }
  
  /**
   * Registers a callback for when the score changes
   */
  registerScoreChangeCallback(callback) {
    this.onScoreChange = callback;
  }
  
  /**
   * Registers a callback for when a strike is added
   */
  registerStrikeAddedCallback(callback) {
    this.onStrikeAdded = callback;
  }
  
  /**
   * Registers a callback for when the game is completed
   */
  registerGameCompleteCallback(callback) {
    this.onGameComplete = callback;
  }
  
  /**
   * Returns the question text
   */
  getQuestionText() {
    return this.question ? 
      `Guess what ${this.question.totalVotes} people said was ${this.question.guessPrompt}!` : 
      "No question available for guessing yet";
  }
}

// Create a singleton instance
const gameService = new GameService();
export default gameService;