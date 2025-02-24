const express = require('express');
const path = require('path');
const voteRoutes = require('./votes');
const guessRoutes = require('./guesses');
const adminRoutes = require('./admin');

module.exports = (app) => {
  // Use the votes routes for any routes under "/guesses"
  app.use('/votes', voteRoutes);
  app.use('/guesses', guessRoutes);
  app.use('/admin', adminRoutes);

  // Handle GET request for the homepage
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../../frontend/index.html'));
  });

  // In routes/index.js, add this route
  app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/admin.html'));
});
};
