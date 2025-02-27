class Game {
    constructor(ui) {
        // Game state
        this.correctGuesses = [];
        this.maxPoints = 0;
        this.currentScore = 0;
        this.strikes = 0;
        this.MAX_STRIKES = 3;
        this.ui = ui;

        // DOM elements
        this.currentScoreSpan = document.getElementById("current-score");
        this.maxScoreSpan = document.getElementById("max-score");
        this.strikesDiv = document.getElementById("strikes");
    }

    async fetchTodaysQuestion() {
        try {
            const response = await fetch("/guesses/question");
            const data = await response.json();
            
            if (data.question) {
                // Set the question text with vote count
                document.querySelector("h2").textContent = 
                    `Guess what ${data.totalVotes} people said was ${data.question}!`;
                
                // Set max score
                this.maxPoints = data.maxPoints;
                this.maxScoreSpan.textContent = this.maxPoints;
                
                return {
                    success: true,
                    answerCount: data.answerCount
                };
            } else {
                document.querySelector("h2").textContent = "No question available for guessing yet";
                return {
                    success: false
                };
            }
        } catch (error) {
            console.error("Error fetching today's question:", error);
            return {
                success: false
            };
        }
    }

    async fetchTopAnswers() {
        try {
            const response = await fetch("/guesses/top-answers");
            const data = await response.json();
            
            if (data.success && data.data && data.data.length > 0) {
                return {
                    success: true,
                    answers: data.data
                };
            } else {
                console.error("No top answers found");
                return {
                    success: false
                };
            }
        } catch (error) {
            console.error("Error fetching top answers:", error);
            return {
                success: false
            };
        }
    }

    // Updated addStrike method - just tracks strikes and updates UI
    addStrike() {
        this.strikes++;
        const strikeIcons = this.strikesDiv.querySelectorAll('i');
        const icon = strikeIcons[this.strikes - 1];
        icon.classList.replace('far', 'fas');
        icon.classList.add('text-danger', 'strike-reveal');
        
        // We no longer call handleStrikeOut here
        return this.strikes >= this.MAX_STRIKES;
    }

    // New method for checking if the game is over
    isGameOver() {
        return this.strikes >= this.MAX_STRIKES || this.correctGuesses.length === 5;
    }

    // New method for handling correct guesses
    recordCorrectGuess(guess, rank, points) {
        this.updateScore(points);
        this.correctGuesses.push({ guess, rank });
        return this.correctGuesses.length === 5; // Return if all answers found
    }

    updateScore(points) {
        this.currentScore += points;
        this.currentScoreSpan.textContent = this.currentScore;
    }
}

export default Game;