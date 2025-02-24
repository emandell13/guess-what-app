module.exports = (req, res, next) => {
    // Check for admin credentials from environment variables
    const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'adminpass';
    
    // Get auth header
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
        return res.status(401).json({ 
            error: 'Authorization required',
            message: 'Please provide authentication credentials' 
        });
    }
    
    // Check Basic auth
    const auth = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':');
    const username = auth[0];
    const password = auth[1];
    
    if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
        return res.status(401).json({ 
            error: 'Invalid credentials',
            message: 'The provided credentials are invalid' 
        });
    }
    
    // If credentials match, proceed
    next();
};