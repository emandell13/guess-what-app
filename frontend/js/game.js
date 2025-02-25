class Game {
    constructor(ui, modalManager) {
        // Game state
        this.correctGuesses = [];
        this.maxPoints = 0;
        this.currentScore = 0;
        this.strikes = 0;
        this.MAX_STRIKES = 3;
        this.ui = ui;
        this.modalManager = modalManager;

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

    async fetchTomorrowsQuestion() {
        try {
            const response = await fetch("/votes/question");
            const data = await response.json();
            
            const tomorrowsQuestion = document.getElementById("tomorrows-question");
            if (data.question) {
                tomorrowsQuestion.textContent = data.question.question_text;
            } else {
                document.getElementById("vote-response").textContent = "No question available for voting";
            }
        } catch (error) {
            console.error("Error fetching tomorrow's question:", error);
            document.getElementById("vote-response").textContent = "Failed to load question";
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

    async addStrike() {
        this.strikes++;
        const strikeIcons = this.strikesDiv.querySelectorAll('i');
        const icon = strikeIcons[this.strikes - 1];
        icon.classList.replace('far', 'fas');
        icon.classList.add('text-danger', 'strike-reveal');
        
        if (this.strikes >= this.MAX_STRIKES) {
            await this.handleStrikeOut();
        }
    }

    async handleStrikeOut() {
        // Get the top answers first
        const topAnswersResult = await this.fetchTopAnswers();
        
        // Show all remaining answers
        if (topAnswersResult.success) {
            await this.ui.revealAllRemaining(this, topAnswersResult.answers);
        } else {
            // Fallback to previous method if fetching fails
            await this.ui.revealAllRemaining(this);
        }
        
        // Then show voting section
        setTimeout(() => {
            this.modalManager.showGameComplete();
        }, 2500 * 5); // Wait for all reveals to complete
    }

    showVotingSection() {
        document.getElementById("voting-section").style.display = "block";
    }

    updateScore(points) {
        this.currentScore += points;
        this.currentScoreSpan.textContent = this.currentScore;
    }
}

// Export the Game class
export default Game;