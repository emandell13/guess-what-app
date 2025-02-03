const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const { SocksProxyAgent } = require('socks-proxy-agent'); // Correct import
const app = express();
const port = process.env.PORT || 3000;
const guessRoutes = require('./routes/guesses'); // Import the guesses route
const dotenv = require('dotenv');
dotenv.config();  // Loads environment variables from .env file

const fixieData = process.env.FIXIE_SOCKS_HOST.split(new RegExp('[:/@]+'));

// Log the parsed values to verify
console.log('Parsed FIXIE_SOCKS_HOST values:', fixieData);

const proxyUrl = `socks5://${fixieData[1]}:${fixieData[2]}@${fixieData[3]}:${fixieData[4]}`;
const proxyAgent = new SocksProxyAgent(proxyUrl);

// Log the proxy URL to verify
console.log('Proxy URL:', proxyUrl);

const mongooseOptions = {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  driverInfo: {
    name: 'nodejs',
    version: process.version,
    platform: process.platform,
    proxy: proxyAgent
  }
};

// Log the mongoose options to verify
console.log('Mongoose connection options:', mongooseOptions);

mongoose.connect(process.env.MONGODB_URI, mongooseOptions)
  .then(() => console.log('Connected to database'))
  .catch(error => {
    console.error('Error connecting to MongoDB:', error);
    process.exit(1); // Exit the process with failure
  });

// Middleware to parse JSON bodies
app.use(express.json());  // This is the missing piece!

// Serve static files from the "frontend" folder
app.use(express.static(path.join(__dirname, '../frontend')));

// Use the guesses routes for any routes under "/guesses"
app.use('/guesses', guessRoutes); // Now the guesses-related routes are handled by guesses.js

// Define some questions
const questions = [
    "What is the most popular fruit?",
    "What's your favorite type of vacation?",
    "What's the best kind of pet?"
];

// Route to get a random question
app.get('/question', (req, res) => {
    const randomQuestion = questions[Math.floor(Math.random() * questions.length)];
    res.json({ question: randomQuestion });
});

// Handle GET request for the homepage
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
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

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});