const express = require('express');
const path = require('path');

module.exports = (app) => {
  // Middleware to parse JSON bodies
  app.use(express.json());

  // Serve static files from the "frontend" folder
  app.use(express.static(path.join(__dirname, '../../frontend')));
};
