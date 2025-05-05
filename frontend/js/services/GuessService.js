/**
 * Service that handles guess submissions and checking
 */
import { getVisitorId } from '../utils/visitorUtils.js';
import authService from './AuthService.js';

class GuessService {
  /**
   * Submits a guess to the API
   * @param {string} guess - The user's guess
   * @returns {Promise<Object>} - The result of the guess
   */
  async submitGuess(guess) {
    try {
      // Get visitor ID
      const visitorId = getVisitorId();
      
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
          visitorId: visitorId
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
      const data = await response.json();
      
      // Update the answers to use voteCount instead of points
      if (data && data.answers && !data.error) {
        data.answers = data.answers.map(answer => ({
          rank: answer.rank,
          answer: answer.answer,
          voteCount: answer.rawVotes
        }));
      }
      
      return data;
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