const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;
const guessRoutes = require('./routes/guesses'); // Import the guesses route
const dotenv = require('dotenv');
dotenv.config();  // Loads environment variables from .env

// MongoDB URI from Atlas
const mongoURI = process.env.MONGODB_URI + "?ssl=true"; // Ensure SSL is enabled

// Use Fixie proxy for MongoDB connection if in production
let mongooseOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000
};

if (process.env.NODE_ENV === 'production') {
  const fixieUrl = process.env.FIXIE_URL;
  console.log('FIXIE_URL:', fixieUrl); // Log the FIXIE_URL value
  const HttpsProxyAgent = require('https-proxy-agent');
  const proxyAgent = new HttpsProxyAgent(fixieUrl); // Correct usage
  mongooseOptions.proxy = proxyAgent;
}

mongoose.connect(mongoURI, mongooseOptions)
  .then(() => console.log('MongoDB connected!'))
  .catch(err => console.log('Error connecting to MongoDB:', err));

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