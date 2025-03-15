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
  /**
 * Load user data from local storage and check token validity
 */
  async loadUserFromStorage() {
    try {
      const token = localStorage.getItem(this.tokenKey);
      const userJson = localStorage.getItem(this.userKey);

      if (token && userJson) {
        this.token = token;
        this.user = JSON.parse(userJson);

        // Check if token is expired (this happens asynchronously)
        this.isTokenExpired().then(expired => {
          if (expired) {
            this.handleExpiredToken();
          }
        });
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
  
      if (!data.success && data.message && data.message.includes("email not confirmed")) {
        return {
          success: false,
          message: "Please verify your email before logging in. Check your inbox for a verification link.",
          isEmailVerificationError: true
        };
      }
  
      if (data.success && data.session) {
        // Store auth data
        this.token = data.session.access_token;
        this.user = data.user;
  
        localStorage.setItem(this.tokenKey, this.token);
        localStorage.setItem(this.userKey, JSON.stringify(this.user));
  
        // Import and use the visitor service
        try {
          const visitorId = localStorage.getItem('gwVisitorId');
          if (visitorId) {
            console.log(`Associating visitor ${visitorId} with user ${this.user.id}`);
            
            // Direct API call instead of using the service to avoid circular dependencies
            const associateResponse = await fetch("/api/visitors/associate", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${this.token}`
              },
              body: JSON.stringify({ 
                visitorId: visitorId,
                userId: this.user.id
              }),
            });
            
            const associateResult = await associateResponse.json();
            console.log("Association result:", associateResult);
          }
        } catch (error) {
          console.error("Error associating visitor with user:", error);
        }
  
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
 * Resend verification email to a user
 * @param {string} email - User's email address
 * @returns {Promise<Object>} - Result of the resend operation
 */
async resendVerificationEmail(email) {
  try {
    const response = await fetch("/auth/resend-verification", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
    });
    
    return await response.json();
  } catch (error) {
    console.error("Error resending verification email:", error);
    return {
      success: false,
      message: "An error occurred while resending verification email"
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
   * Check if a user's token is expired
   * Returns true if token is expired or doesn't exist
   */
  async isTokenExpired() {
    try {
      if (!this.token) return true;

      const response = await fetch("/auth/validate", {
        headers: this.getAuthHeaders()
      });

      // If response is 401 with token_expired error, the token is expired
      if (response.status === 401) {
        const data = await response.json();
        return data.error === 'token_expired';
      }

      return !response.ok;
    } catch (error) {
      console.error("Token validation error:", error);
      return true; // Assume expired on error
    }
  }

  /**
   * Handle token expiration by clearing storage and notifying the UI
   */
  handleExpiredToken() {
    // Clear token and user data
    this.token = null;
    this.user = null;

    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);

    // Dispatch event to update UI
    const logoutEvent = new CustomEvent('user-logout', {
      detail: { reason: 'token_expired' }
    });
    document.dispatchEvent(logoutEvent);

    // Optionally show a message
    const message = "Your session has expired. Please log in again.";
    if (typeof showToast === 'function') {
      showToast(message); // If you have a toast function
    } else {
      alert(message);
    }
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

      const data = await response.json();

      // Check for token expiration
      if (response.status === 401 && data.error === 'token_expired') {
        // Clear stored auth data since token is expired
        this.token = null;
        this.user = null;
        localStorage.removeItem(this.tokenKey);
        localStorage.removeItem(this.userKey);

        return {
          success: false,
          error: 'token_expired',
          message: "Your session has expired. Please log in again."
        };
      }

      return data;
    } catch (error) {
      console.error("Get profile error:", error);
      return {
        success: false,
        message: "Failed to fetch profile"
      };
    }
  }

  /**
 * Refresh the authentication token if needed
 * @returns {Promise<boolean>} - Whether the token was refreshed successfully
 */
async refreshTokenIfNeeded() {
  if (!this.token || !this.user) return false;
  
  try {
    // Call Supabase's token refresh endpoint
    const response = await fetch("/auth/refresh", {
      method: "POST",
      headers: this.getAuthHeaders()
    });
    
    if (!response.ok) return false;
    
    const data = await response.json();
    
    if (data.success && data.session) {
      // Store the new tokens
      this.token = data.session.access_token;
      localStorage.setItem(this.tokenKey, this.token);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error("Token refresh error:", error);
    return false;
  }
}
}

// Create a singleton instance
const authService = new AuthService();
export default authService;