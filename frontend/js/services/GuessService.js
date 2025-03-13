import { getSessionId } from '../utils/sessionUtils.js';
import authService from './AuthService.js';

/**
 * Service that handles guess submissions and checking
 */
class GuessService {
  /**
   * Submits a guess to the API
   * @param {string} guess - The user's guess
   * @returns {Promise<Object>} - The result of the guess
   */
  async submitGuess(guess) {
    try {
      // Get session ID
      const sessionId = getSessionId();
      
      // Create headers
      const headers = {
        "Content-Type": "application/json",
      };
      
      // Add auth token if user is authenticated
      if (authService.isAuthenticated()) {
        headers["Authorization"] = `Bearer ${authService.token}`;
      }
      
      const response = await fetch("/guesses", {
        method: "POST",
        headers: headers,
        body: JSON.stringify({ 
          guess: guess,
          sessionId: sessionId
        }),
      });
      
      return await response.json();
    } catch (error) {
      console.error("Error submitting guess:", error);
      return { 
        error: true, 
        message: "Failed to submit guess" 
      };
    }
  }
  
  /**
   * Fetches all answers for the current question
   * @returns {Promise<Object>} - The answers data
   */
  async getAllAnswers() {
    try {
      const response = await fetch("/guesses/question?includeAnswers=true");
      return await response.json();
    } catch (error) {
      console.error("Error fetching answers:", error);
      return { 
        error: true, 
        message: "Failed to fetch answers" 
      };
    }
  }
}

// Create a singleton instance
const guessService = new GuessService();
export default guessService;