const supabase = require('../config/supabase');

/**
 * Service for handling user authentication
 */
const authService = {
  /**
   * Register a new user
   * @param {string} email - User's email address
   * @param {string} password - User's password
   * @param {string} username - User's display name
   * @returns {Promise<Object>} The registration result
   */
  async registerUser(email, password, username) {
    try {
      // Check if username already exists
      const { data: existingUsers, error: usernameError } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', username)
        .limit(1);
        
      if (usernameError) throw usernameError;
      
      if (existingUsers && existingUsers.length > 0) {
        return {
          success: false,
          message: 'Username already taken'
        };
      }
      
      // Register user with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) throw authError;
      
      if (!authData.user) {
        throw new Error('User registration failed');
      }

      // Add user profile data to profiles table
      const { error: profileError } = await supabase
        .from('profiles')
        .insert([
          { 
            id: authData.user.id,
            username,
            created_at: new Date().toISOString(),
          }
        ]);

      if (profileError) throw profileError;

      return {
        success: true,
        message: 'Registration successful. Please check your email to confirm your account.',
        userId: authData.user.id,
      };
    } catch (error) {
      console.error('Registration error:', error);
      return {
        success: false,
        message: error.message || 'Registration failed',
      };
    }
  },

  /**
   * Login a user
   * @param {string} email - User's email address
   * @param {string} password - User's password
   * @returns {Promise<Object>} The login result
   */
  async loginUser(email, password) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      
      // Update last login time in profiles table
      await supabase
        .from('profiles')
        .update({ last_login: new Date().toISOString() })
        .eq('id', data.user.id);

      return {
        success: true,
        user: {
          id: data.user.id,
          email: data.user.email,
        },
        session: data.session,
      };
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        message: error.message || 'Invalid credentials',
      };
    }
  },

  /**
   * Get user profile by ID
   * @param {string} userId - The user's ID
   * @returns {Promise<Object>} The user profile data
   */
  async getUserProfile(userId) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
        
      if (error) throw error;
      
      return {
        success: true,
        profile: data,
      };
    } catch (error) {
      console.error('Get profile error:', error);
      return {
        success: false,
        message: error.message || 'Failed to get user profile',
      };
    }
  },

  /**
   * Verify a JWT token
   * @param {string} token - JWT token to verify
   * @returns {Promise<Object>} The verification result
   */
  async verifyToken(token) {
    try {
      const { data, error } = await supabase.auth.getUser(token);
      
      if (error) throw error;
      
      return {
        success: true,
        user: data.user,
      };
    } catch (error) {
      console.error('Token verification error:', error);
      return {
        success: false,
        message: error.message || 'Invalid token',
      };
    }
  }
};

module.exports = authService;