const express = require('express');
const router = express.Router();
const authService = require('../services/authService');
const authMiddleware = require('../middleware/authMiddleware'); // Use your chosen middleware name here

// User registration
router.post('/register', async (req, res) => {
  try {
    const { email, password, username } = req.body;
    
    // Validate input
    if (!email || !password || !username) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Email, password, and username are required'
      });
    }
    
    // Call the auth service to register the user
    const result = await authService.registerUser(email, password, username);
    
    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Registration route error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'An unexpected error occurred during registration'
    });
  }
});

// User login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        error: 'Missing credentials',
        message: 'Email and password are required'
      });
    }
    
    // Call the auth service to log in the user
    const result = await authService.loginUser(email, password);
    
    if (result.success) {
      // Optionally set a cookie with the token
      if (result.session) {
        res.cookie('authToken', result.session.access_token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          maxAge: 60 * 60 * 24 * 7 * 1000 // 1 week
        });
      }
      
      res.json(result);
    } else {
      res.status(401).json(result);
    }
  } catch (error) {
    console.error('Login route error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'An unexpected error occurred during login'
    });
  }
});

// Get the current user's profile (protected route)
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get user profile from the database
    const result = await authService.getUserProfile(userId);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    console.error('Profile route error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'An unexpected error occurred while fetching profile'
    });
  }
});

// Log out the user
router.post('/logout', (req, res) => {
  // Clear the auth cookie if it was set
  res.clearCookie('authToken');
  
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

module.exports = router;