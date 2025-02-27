class Guessing {
    constructor(game, ui, modalManager) {
        this.game = game;
        this.ui = ui;
        this.modalManager = modalManager;
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
        // Check if game is already over
        if (this.game.isGameOver()) {
            this.modalManager.showGameComplete();
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
                
                // Record correct guess and check if all answers found
                const allAnswersFound = this.game.recordCorrectGuess(userGuess, result.rank, result.points);
                
                // If all answers found, show completion modal
                if (allAnswersFound) {
                    setTimeout(() => {
                        this.modalManager.showGameComplete();
                    }, 1000);
                }
            } else {
                // Add strike and check if max strikes reached
                const maxStrikesReached = this.game.addStrike();
                
                if (maxStrikesReached) {
                    // Reveal all remaining answers first
                    await this.ui.revealAllRemaining(this.game);
                    
                    // Then show the completion modal
                    this.modalManager.showGameComplete();
                }
            }

        } catch (error) {
            console.error("Error:", error);
        }

        this.form.reset();
    }
}

export default Guessing;