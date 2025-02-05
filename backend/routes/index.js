const express = require('express');
const path = require('path');
const voteRoutes = require('./votes');

const questions = [
  "What is the most popular fruit?",
  "What's your favorite type of vacation?",
  "What's the best kind of pet?"
];

module.exports = (app) => {
  // Use the votes routes for any routes under "/guesses"
  app.use('/votes', voteRoutes);

  // Route to get a random question
  app.get('/question', (req, res) => {
    const randomQuestion = questions[Math.floor(Math.random() * questions.length)];
    res.json({ question: randomQuestion });
  });

  // Handle GET request for the homepage
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../../frontend/index.html'));
  });
};
