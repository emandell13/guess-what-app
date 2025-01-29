const express = require('express');
const mongoose = require('mongoose')
const path = require('path');
const app = express();
const PORT = 3000;
const guessRoutes = require('./routes/guesses'); // Import the guesses route

// MongoDB URI from Atlas
const mongoURI = "mongodb+srv://eric:6Kw62qN6hTkCN99p@guess-what-cluster.tv6zt.mongodb.net/?retryWrites=true&w=majority&appName=guess-what-cluster";

mongoose.connect(mongoURI)
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

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});