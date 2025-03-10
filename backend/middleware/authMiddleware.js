const supabase = require('../config/supabase');

/**
 * Middleware to verify if a user is authenticated
 */
const authMiddleware = async (req, res, next) => {
  // Get the authorization header
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'auth_required',
      message: 'Authentication required'
    });
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    // Use getUser with the token directly
    const { data, error } = await supabase.auth.getUser(token);
    
    if (error) {
      // Check specifically for expired token
      if (error.message.includes('expired')) {
        return res.status(401).json({
          error: 'token_expired',
          message: 'Your session has expired. Please log in again.'
        });
      }
      throw error;
    }
    
    if (!data || !data.user) {
      throw new Error('Invalid authentication token');
    }
    
    // Add the user object to the request
    req.user = data.user;
    next();
  } catch (error) {
    return res.status(401).json({
      error: 'authentication_failed',
      message: error.message || 'Invalid authentication token'
    });
  }
};

module.exports = authMiddleware;