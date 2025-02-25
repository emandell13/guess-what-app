const express = require('express');
const path = require('path');
const voteRoutes = require('./votes');
const guessRoutes = require('./guesses');
const adminRoutes = require('./admin');

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

  // Handle GET request for the homepage
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../../frontend/index.html'));
  });
};