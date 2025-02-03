const express = require('express');
const path = require('path');
const guessRoutes = require('./guesses');
const mongoose = require('mongoose'); // Ensure mongoose is imported
const { SocksProxyAgent } = require('socks-proxy-agent'); // Ensure SocksProxyAgent is imported

const questions = [
  "What is the most popular fruit?",
  "What's your favorite type of vacation?",
  "What's the best kind of pet?"
];

module.exports = (app) => {
  // Use the guesses routes for any routes under "/guesses"
  app.use('/guesses', guessRoutes);

  // Route to get a random question
  app.get('/question', (req, res) => {
    const randomQuestion = questions[Math.floor(Math.random() * questions.length)];
    res.json({ question: randomQuestion });
  });

  // Handle GET request for the homepage
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../../frontend/index.html'));
  });

  // Test route to verify MongoDB connection
  app.get('/test-mongo', async (req, res) => {
    try {
      const result = await mongoose.connection.db.admin().ping();
      res.json({ message: 'MongoDB connection is successful', result });
    } catch (err) {
      res.status(500).json({ message: 'MongoDB connection failed', error: err });
    }
  });

  // Test route to verify proxy connection
  app.get('/test-proxy', async (req, res) => {
    try {
      const fixieData = process.env.FIXIE_SOCKS_HOST.split(new RegExp('[:/@]+'));
      const proxyUrl = `socks5://${fixieData[0]}:${fixieData[1]}@${fixieData[2]}:${fixieData[3]}`;
      const proxyAgent = new SocksProxyAgent(proxyUrl);

      // Test the proxy connection
      const response = await fetch('https://www.google.com', { agent: proxyAgent });
      const text = await response.text();
      res.json({ message: 'Proxy connection is successful', text });
    } catch (err) {
      res.status(500).json({ message: 'Proxy connection failed', error: err });
    }
  });
};
