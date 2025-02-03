const express = require('express');
const app = express();
const port = process.env.PORT || 3000;
const dotenv = require('dotenv');
dotenv.config();

// Connect to MongoDB
const mongoose = require('./config/mongoose');

// Setup middleware
require('./middleware')(app);

// Setup routes
require('./routes')(app);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});