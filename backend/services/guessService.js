// services/guessService.js
let guessCounts = {}; // Store guesses and their frequencies

function handleGuess(guess) {
    if (guessCounts[guess]) {
        guessCounts[guess] += 1; // Increment the count for this guess
    } else {
        guessCounts[guess] = 1; // Initialize count for a new guess
    }
    return getTopGuesses(); // Return the top guesses after updating
}

function getTopGuesses() {
    return Object.entries(guessCounts)
        .sort((a, b) => b[1] - a[1]) // Sort by frequency in descending order
        .map(entry => `${entry[0]} (${entry[1]})`); // Format as "Guess (count)"
}

module.exports = { handleGuess, getTopGuesses }; // Export the functions