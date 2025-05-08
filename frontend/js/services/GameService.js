import { getVisitorId, saveTodayGuesses, getTodayGuesses, markTodayCompleted, saveTodayStrikes, getTodayStrikes, markTodayGaveUp, hasTodayGivenUp} from '../utils/visitorUtils.js';
import authService from './AuthService.js';
import eventService from './EventService.js';

/**
 * Service that manages game state and logic
 */
class GameService {
  constructor() {
    // Game state
    this.correctGuesses = [];
    this.incorrectGuesses = [];
    this.totalGuesses = 0;
    this.question = null;
    this.answerCount = 5; // Default
    this.gaveUp = false;
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
      totalGuesses: this.totalGuesses,
      answerCount: this.answerCount,
      gaveUp: this.gaveUp
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
      this.correctGuesses = savedGuesses.filter(guess => guess.isCorrect);
      this.incorrectGuesses = savedGuesses.filter(guess => !guess.isCorrect);
  
      // Calculate total guesses
      this.totalGuesses = savedGuesses.length;
    }
  
    // Load saved strikes (we'll repurpose this to track incorrect guesses count)
    const savedIncorrectGuesses = getTodayStrikes();
    if (savedIncorrectGuesses > 0) {
      // Ensure our incorrect guesses count matches saved value
      if (this.incorrectGuesses.length !== savedIncorrectGuesses) {
        this.incorrectGuesses = Array(savedIncorrectGuesses).fill({ isCorrect: false });
      }
    }
  
    // Restore gave up state
    this.gaveUp = hasTodayGivenUp();
  }

  /**
   * Records a correct guess
   */
  recordCorrectGuess(guess, rank, voteCount, canonicalAnswer) {
    // Check if this rank has already been guessed
    const alreadyGuessed = this.correctGuesses.some(g => g.rank === rank);

    // If already guessed, return false (not a new correct guess)
    if (alreadyGuessed) {
      // Emit already guessed event
      eventService.emit('game:already-guessed', {
        guess: canonicalAnswer || guess,
        rank,
        voteCount
      });

      return {
        success: false,
        alreadyGuessed: true
      };
    }

    // Increment total guesses
    this.totalGuesses++;

    // Add the guess with vote count information
    const guessInfo = {
      guess: canonicalAnswer || guess,
      rank,
      voteCount,
      isCorrect: true
    };

    this.correctGuesses.push(guessInfo);

    // Save progress locally
    this.saveLocalProgress();

    // Save progress to server
    this.saveUserGameData();

    // Emit answer revealed event
    eventService.emit('game:answer-revealed', {
      guess: canonicalAnswer || guess,
      rank,
      voteCount,
      canonicalAnswer
    });
    // Emit guess counter updated event
    eventService.emit('game:guess-counter-updated', {
      totalGuesses: this.totalGuesses
    });

    // Check if game is complete
    const gameComplete = this.isGameOver();

    if (gameComplete) {
      markTodayCompleted();

      // Save final game state to server
      this.saveUserGameData();

      // Emit game completed event
      eventService.emit('game:completed', {
        correctGuesses: this.correctGuesses,
        incorrectGuesses: this.incorrectGuesses,
        totalGuesses: this.totalGuesses,
        gaveUp: this.gaveUp
      });
    }

    return {
      success: true,
      gameComplete
    };
  }

  /**
   * Records an incorrect guess
   */
  recordIncorrectGuess(guess) {
    // Increment total guesses
    this.totalGuesses++;

    // Add to incorrect guesses
    this.incorrectGuesses.push({
      guess: guess,
      isCorrect: false
    });

    // Save progress locally
    this.saveLocalProgress();

    // Save progress to server
    this.saveUserGameData();

    // Emit incorrect guess event
    eventService.emit('game:incorrect-guess', {
      guess: guess,
      totalGuesses: this.totalGuesses,
      incorrectGuesses: this.incorrectGuesses.length
    });

    eventService.emit('game:guess-counter-updated', {
      totalGuesses: this.totalGuesses
    });

    return {
      success: true
    };
  }

  /**
   * Handles giving up on the game
   */
  async giveUp() {
    try {
      // Get visitor ID
      const visitorId = getVisitorId();

      console.log("GameService.giveUp - Starting give up process");

      // Create headers
      const headers = {
        "Content-Type": "application/json",
      };

      // Add auth token if user is authenticated
      if (authService.isAuthenticated()) {
        headers["Authorization"] = `Bearer ${authService.token}`;
      }

      const response = await fetch("/guesses/giveup", {
        method: "POST",
        headers: headers,
        body: JSON.stringify({
          visitorId: visitorId
        }),
      });

      const result = await response.json();

      if (result.success) {
        // Mark as gave up
        this.gaveUp = true;
        console.log("GameService.giveUp - Set gaveUp=true");
        markTodayGaveUp();
        markTodayCompleted();

        // Mark as completed
        markTodayCompleted();

        // Save final game state to server
        this.saveUserGameData();

        // Filter out already guessed answers
        const alreadyGuessedRanks = this.correctGuesses.map(guess => guess.rank);
        const filteredAnswers = result.answers.filter(answer =>
          !alreadyGuessedRanks.includes(answer.rank)
        );

        // Emit gave up event with filtered answers
        eventService.emit('game:gave-up', {
          remainingAnswers: filteredAnswers,
          totalGuesses: this.totalGuesses
        });

        // Also emit game completed event
        console.log("GameService.giveUp - Emitting game:completed with gaveUp=true");
        eventService.emit('game:completed', {
          correctGuesses: this.correctGuesses,
          incorrectGuesses: this.incorrectGuesses,
          totalGuesses: this.totalGuesses,
          gaveUp: this.gaveUp
        });
      }

      return result;
    } catch (error) {
      console.error("Error giving up:", error);
      return {
        success: false,
        error: "Failed to give up"
      };
    }
  }

  /**
   * Saves the current progress to localStorage
   */
  saveLocalProgress() {
    // Combine correct and incorrect guesses for local storage
    const allGuesses = [...this.correctGuesses, ...this.incorrectGuesses];
    saveTodayGuesses(allGuesses);

    // Save incorrect guesses count
    saveTodayStrikes(this.incorrectGuesses.length);
  }

  /**
   * Checks if the game is over
   */
  isGameOver() {
    // Game is over if all answers are found or player gave up
    const allAnswersFound = this.correctGuesses.length >= this.answerCount;

    return this.gaveUp || allAnswersFound;
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
        total_guesses: this.totalGuesses,
        strikes: this.incorrectGuesses.length, // Repurpose strikes to track incorrect guesses
        gave_up: this.gaveUp,
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