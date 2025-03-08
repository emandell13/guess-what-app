/**
 * Service for handling user authentication
 */
class AuthService {
    constructor() {
      this.tokenKey = 'gw_auth_token';
      this.userKey = 'gw_user';
      
      // Check if we have token in storage when service initializes
      this.loadUserFromStorage();
    }
    
    /**
     * Load user data from local storage
     */
    loadUserFromStorage() {
      try {
        const token = localStorage.getItem(this.tokenKey);
        const userJson = localStorage.getItem(this.userKey);
        
        if (token && userJson) {
          this.token = token;
          this.user = JSON.parse(userJson);
        } else {
          this.token = null;
          this.user = null;
        }
      } catch (error) {
        console.error("Error loading auth from storage:", error);
        this.token = null;
        this.user = null;
      }
    }
    
    /**
     * Register a new user
     * @param {string} email - User email
     * @param {string} password - User password
     * @param {string} username - User's display name
     * @returns {Promise<Object>} - Registration result
     */
    async register(email, password, username) {
      try {
        const response = await fetch("/auth/register", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email, password, username }),
        });
        
        const data = await response.json();
        
        return data;
      } catch (error) {
        console.error("Registration error:", error);
        return { 
          success: false, 
          message: "An error occurred during registration" 
        };
      }
    }
    
    /**
     * Login a user
     * @param {string} email - User email
     * @param {string} password - User password
     * @returns {Promise<Object>} - Login result
     */
    async login(email, password) {
      try {
        const response = await fetch("/auth/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email, password }),
        });
        
        const data = await response.json();
        
        if (data.success && data.session) {
          // Store auth data
          this.token = data.session.access_token;
          this.user = data.user;
          
          localStorage.setItem(this.tokenKey, this.token);
          localStorage.setItem(this.userKey, JSON.stringify(this.user));
          
          // Trigger login event for components that need to update
          const loginEvent = new CustomEvent('user-login', { detail: this.user });
          document.dispatchEvent(loginEvent);
        }
        
        return data;
      } catch (error) {
        console.error("Login error:", error);
        return { 
          success: false, 
          message: "An error occurred during login" 
        };
      }
    }
    
    /**
     * Logout the current user
     */
    async logout() {
      try {
        await fetch("/auth/logout", {
          method: "POST",
          headers: this.getAuthHeaders(),
        });
        
        // Clear stored data regardless of server response
        this.token = null;
        this.user = null;
        
        localStorage.removeItem(this.tokenKey);
        localStorage.removeItem(this.userKey);
        
        // Trigger logout event for components that need to update
        const logoutEvent = new CustomEvent('user-logout');
        document.dispatchEvent(logoutEvent);
        
        return { success: true };
      } catch (error) {
        console.error("Logout error:", error);
        return { 
          success: false, 
          message: "An error occurred during logout" 
        };
      }
    }
    
    /**
     * Get the current authenticated user
     * @returns {Object|null} - User object or null if not authenticated
     */
    getCurrentUser() {
      return this.user;
    }
    
    /**
     * Check if a user is currently authenticated
     * @returns {boolean} - Whether user is authenticated
     */
    isAuthenticated() {
      return !!this.token && !!this.user;
    }
    
    /**
     * Get the authentication headers for API requests
     * @returns {Object} - Headers object with authorization
     */
    getAuthHeaders() {
      return this.token ? {
        "Authorization": `Bearer ${this.token}`,
        "Content-Type": "application/json"
      } : {
        "Content-Type": "application/json"
      };
    }
    
    /**
     * Get the user profile data
     * @returns {Promise<Object>} - Profile data
     */
    async getProfile() {
      if (!this.isAuthenticated()) {
        return {
          success: false,
          message: "Not authenticated"
        };
      }
      
      try {
        const response = await fetch("/auth/profile", {
          headers: this.getAuthHeaders(),
        });
        
        return await response.json();
      } catch (error) {
        console.error("Get profile error:", error);
        return { 
          success: false, 
          message: "Failed to fetch profile" 
        };
      }
    }
  }
  
  // Create a singleton instance
  const authService = new AuthService();
  export default authService;