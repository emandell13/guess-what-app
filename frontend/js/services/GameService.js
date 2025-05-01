import { getVisitorId, saveTodayGuesses, getTodayGuesses, markTodayCompleted, saveTodayStrikes, getTodayStrikes } from '../utils/visitorUtils.js';
import authService from './AuthService.js';
import eventService from './EventService.js';
import gameConfig from '../config/gameConfig.js';

/**
 * Service that manages game state and logic
 */
class GameService {
  constructor() {
    // Game state
    this.correctGuesses = [];
    this.maxPoints = gameConfig.MAX_POINTS;
    this.currentScore = 0;
    this.strikes = 0;
    this.MAX_STRIKES = gameConfig.MAX_STRIKES;
    this.question = null;
    this.answerCount =  gameConfig.DEFAULT_ANSWER_COUNT;
  }
  
  /**
   * Initializes the game by fetching question data and restoring saved state
   */
  async initialize() {
    await this.fetchTodaysQuestion();
    this.restoreGameState();
    
    // Emit initialization event
    eventService.emit('game:initialized', {
      question: this.question,
      correctGuesses: this.correctGuesses,
      currentScore: this.currentScore,
      maxPoints: this.maxPoints,
      strikes: this.strikes,
      answerCount: this.answerCount
    });
    
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
        // Max points is now always 100
        this.maxPoints = 100;
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
      // Emit already guessed event
      eventService.emit('game:already-guessed', {
        guess: canonicalAnswer || guess,
        rank,
        points
      });
      
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
    
    // Save progress locally
    saveTodayGuesses(this.correctGuesses);
    
    // Save progress to server
    this.saveUserGameData();
    
    // Emit answer revealed event
    eventService.emit('game:answer-revealed', {
      guess: canonicalAnswer || guess,
      rank,
      points,
      canonicalAnswer
    });
    
    // Check if game is complete
    const gameComplete = this.isGameOver();
    
    if (gameComplete) {
      markTodayCompleted();
      
      // Save final game state to server
      this.saveUserGameData();
      
      // Emit game completed event
      eventService.emit('game:completed', {
        currentScore: this.currentScore,
        maxPoints: this.maxPoints,
        strikes: this.strikes,
        correctGuesses: this.correctGuesses
      });
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
    
    // Save progress to server
    this.saveUserGameData();
    
    // Emit strike added event
    eventService.emit('game:strike-added', {
      strikes: this.strikes,
      maxStrikes: this.MAX_STRIKES
    });
    
    const maxStrikesReached = this.strikes >= this.MAX_STRIKES;
    
    // Mark game as completed if max strikes reached
    if (maxStrikesReached) {
      markTodayCompleted();
      
      // Save final game state to server
      this.saveUserGameData();
      
      // Emit game completed event
      eventService.emit('game:completed', {
        currentScore: this.currentScore,
        maxPoints: this.maxPoints,
        strikes: this.strikes,
        correctGuesses: this.correctGuesses
      });
    }
    
    return maxStrikesReached;
  }
  
  /**
   * Updates the current score
   */
  updateScore(points) {
    this.currentScore += points;
    
    // Emit score change event
    eventService.emit('game:score-change', {
      currentScore: this.currentScore,
      maxPoints: this.maxPoints
    });
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
   * Returns the question text
   */
  getQuestionText() {
    return this.question ? 
      `What did <span class="clickable-number" id="people-count">${this.question.totalVotes} people</span> say was ${this.question.guessPrompt}` : 
      "No question available for guessing yet";
  }

  /**
   * Saves the current game data to the server
   */
  async saveUserGameData() {
    try {
      // Make sure we have a question ID
      if (!this.question || !this.question.id) {
        console.error("Cannot save game data: missing question ID");
        return { success: false, message: "Missing question ID" };
      }
      
      // Use visitorId for identification, even for anonymous users
      const visitorId = getVisitorId();
      
      // Create headers
      const headers = {
        "Content-Type": "application/json",
      };
      
      // Add auth token if user is authenticated
      if (authService.isAuthenticated()) {
        headers["Authorization"] = `Bearer ${authService.token}`;
      }
      
      const gameData = {
        question_id: this.question.id,
        final_score: this.currentScore,
        strikes: this.strikes,
        completed: this.isGameOver(),
        visitor_id: visitorId
      };
      
      const response = await fetch("/user/save-game", {
        method: "POST",
        headers: headers,
        body: JSON.stringify(gameData),
      });
      
      return await response.json();
    } catch (error) {
      console.error("Error saving game data:", error);
      return { 
        success: false, 
        message: "Failed to save game data" 
      };
    }
  }
}

// Create a singleton instance
const gameService = new GameService();
export default gameService;