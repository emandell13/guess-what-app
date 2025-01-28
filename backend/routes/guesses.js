// routes/guesses.js
const express = require('express');
const router = express.Router();
const guessService = require('../services/guessService'); // Import the business logic

router.post('/submit', (req, res) => {
    const { guess } = req.body;
    const topGuesses = guessService.handleGuess(guess); // Use the guessService to handle the logic
    res.json({ message: `Your guess "${guess}" was received!`, topGuesses });
});

module.exports = router; // Export the router to use in server.js