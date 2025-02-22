class Guessing {
    constructor(game, ui) {
        this.game = game;
        this.ui = ui;
        this.form = document.getElementById("guess-form");
        this.setupEventListeners();
    }

    setupEventListeners() {
        this.form.addEventListener("submit", async (event) => {
            event.preventDefault();
            await this.handleGuess(event);
        });
    }

    async handleGuess(event) {
        if (this.game.strikes >= this.game.MAX_STRIKES) {
            this.game.showVotingSection();
            return;
        }

        const userGuess = this.form.elements[0].value;

        try {
            const response = await fetch("/guesses", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ guess: userGuess }),
            });

            const result = await response.json();

            if (result.isCorrect) {
                // Reveal answer with animation
                this.ui.revealAnswer(result.rank, userGuess, result.points);
                
                // Update game state
                this.game.updateScore(result.points);
                this.game.correctGuesses.push({ guess: userGuess, rank: result.rank });
                
                // Check if all answers found
                if (this.game.correctGuesses.length === 5) {
                    this.game.showVotingSection();
                }
            } else {
                this.game.addStrike();
            }

        } catch (error) {
            console.error("Error:", error);
        }

        this.form.reset();
    }
}

export default Guessing;