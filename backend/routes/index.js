const express = require('express');
const path = require('path');
const voteRoutes = require('./votes');
const guessRoutes = require('./guesses');
const adminRoutes = require('./admin/index');
const authRoutes = require('./auth');
const userHistoryRoutes = require('./userHistory');
const visitorRoutes = require('./visitors');

module.exports = (app) => {
  // Serve static files first
  app.use(express.static(path.join(__dirname, '../../frontend')));

  // HTML route for admin dashboard
  app.get('/admin-dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, '../../frontend/admin.html'));
  });

  // API routes
  app.use('/votes', voteRoutes);
  app.use('/guesses', guessRoutes);
  app.use('/admin', adminRoutes);
  app.use('/auth', authRoutes);
  app.use('/user', userHistoryRoutes);
  app.use('/api/visitors', visitorRoutes); // Add this line

  // Handle GET request for the homepage
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../../frontend/index.html'));
  });

  // Handle email verification redirect
  app.get('/auth/verify', (req, res) => {
    // Redirect to main page with a verification success parameter
    res.redirect('/?verified=success');
  });
};