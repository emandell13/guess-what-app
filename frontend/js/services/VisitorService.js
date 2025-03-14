/**
 * Service for tracking visitors
 */
import { getVisitorId } from '../utils/visitorUtils.js';
import authService from './AuthService.js';

class VisitorService {
  /**
   * Registers the current visitor with the backend
   * Should be called when the app initializes
   */
  async registerVisitor() {
    try {
      const visitorId = getVisitorId();
      
      // Create headers
      const headers = {
        "Content-Type": "application/json",
      };
      
      // Add auth token if user is authenticated
      if (authService.isAuthenticated()) {
        headers["Authorization"] = `Bearer ${authService.token}`;
      }
      
      const response = await fetch("/api/visitors/register", {
        method: "POST",
        headers: headers,
        body: JSON.stringify({ 
          visitorId: visitorId 
        }),
      });
      
      const result = await response.json();
      
      if (!result.success) {
        console.error("Error registering visitor:", result.error);
      }
      
      return result;
    } catch (error) {
      console.error("Error registering visitor:", error);
      return { 
        success: false, 
        error: "Failed to register visitor" 
      };
    }
  }
  
  /**
   * Associates the current visitor with a user ID
   * Should be called when a user logs in
   * 
   * @param {string} userId - The user's ID
   */
  async associateWithUser(userId) {
    try {
      if (!userId) {
        return {
          success: false,
          error: "User ID is required"
        };
      }
      
      const visitorId = getVisitorId();
      
      const response = await fetch("/api/visitors/associate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authService.token}`
        },
        body: JSON.stringify({ 
          visitorId: visitorId,
          userId: userId
        }),
      });
      
      return await response.json();
    } catch (error) {
      console.error("Error associating visitor with user:", error);
      return {
        success: false,
        error: "Failed to associate visitor with user"
      };
    }
  }
}

// Create a singleton instance
const visitorService = new VisitorService();
export default visitorService;