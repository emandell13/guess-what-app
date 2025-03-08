const supabase = require('../config/supabase');

/**
 * Middleware to verify if a user is authenticated
 */
const authMiddleware = async (req, res, next) => {
  // Get the authorization header
  const token = req.headers.authorization?.split(' ')[1] || req.cookies?.authToken;
  
  if (!token) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'You must be logged in to access this resource'
    });
  }

  try {
    // Verify the token with Supabase
    const { data, error } = await supabase.auth.getUser(token);
    
    if (error || !data.user) {
      throw new Error('Invalid or expired token');
    }

    // Add the user object to the request
    req.user = data.user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({
      error: 'Authentication failed',
      message: error.message || 'Invalid authentication token'
    });
  }
};

module.exports = authMiddleware;