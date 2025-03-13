import { getVisitorId, hasVotedForTomorrow, markTomorrowVoted } from '../utils/visitorUtils.js';
import authService from './AuthService.js';

/**
 * Service that handles voting operations
 */
class VoteService {
  constructor() {
    this.tomorrowsQuestionText = null;
  }
  
  /**
   * Fetches tomorrow's question text
   * @returns {Promise<string|null>} - The question text or null
   */
  async fetchTomorrowsQuestion() {
    try {
      const response = await fetch("/votes/question");
      const data = await response.json();
      
      if (data.question) {
        this.tomorrowsQuestionText = data.question.question_text;
        return data.question.question_text;
      } else {
        this.tomorrowsQuestionText = "No question available";
        return null;
      }
    } catch (error) {
      console.error("Error fetching tomorrow's question:", error);
      this.tomorrowsQuestionText = "Error loading question";
      return null;
    }
  }
  
  /**
   * Submits a vote for tomorrow's question
   * @param {string} userResponse - The user's response
   * @returns {Promise<Object>} - The result of the vote
   */
  async submitVote(userResponse) {
    try {
      // Check if user has already voted for tomorrow
      if (hasVotedForTomorrow()) {
        return {
          success: false,
          message: "You've already voted for tomorrow's question!"
        };
      }
      
      // Include the visitor ID with the vote
      const visitorId = getVisitorId();
      
      // Create headers
      const headers = {
        "Content-Type": "application/json",
      };
      
      // Add auth token if user is authenticated
      if (authService.isAuthenticated()) {
        headers["Authorization"] = `Bearer ${authService.token}`;
      }
      
      const response = await fetch("/votes", {
        method: "POST",
        headers: headers,
        body: JSON.stringify({ 
          response: userResponse,
          visitorId: visitorId
        }),
      });

      const result = await response.json();
      
      // If successful, mark that the user has voted
      if (response.ok) {
        markTomorrowVoted();
      }
      
      return {
        success: response.ok,
        message: response.ok ? "Thank you for your vote!" : (result.error || "Failed to submit vote"),
        data: result
      };
    } catch (error) {
      console.error("Error:", error);
      return {
        success: false,
        message: "An error occurred. Please try again."
      };
    }
  }
  
  /**
   * Checks if the user has already voted for tomorrow
   * @returns {boolean} - Whether the user has voted
   */
  hasAlreadyVoted() {
    return hasVotedForTomorrow();
  }
  
  /**
   * Gets the text for tomorrow's question
   * @returns {string} - The question text
   */
  getTomorrowsQuestionText() {
    return this.tomorrowsQuestionText || "Tomorrow's question";
  }
}

// Create a singleton instance
const voteService = new VoteService();
export default voteService;