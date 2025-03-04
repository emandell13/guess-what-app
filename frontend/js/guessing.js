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
                const alreadyGuessed = this.game.correctGuesses.some(g => g.rank === result.rank);
                
                if (alreadyGuessed) {
                    // Show a message that this was already guessed
                    // You can create a toast notification or some other UI feedback
                    this.showAlreadyGuessedMessage(result.canonicalAnswer || userGuess);
                } else {

                // Reveal answer with animation
                this.ui.revealAnswer(result.rank, userGuess, result.points, result.canonicalAnswer);
                
                // Record correct guess and check if all answers found
                const allAnswersFound = this.game.recordCorrectGuess(
                    userGuess,
                    result.rank,
                    result.points,
                    result.canonicalAnswer
                );

                if (this.game.isGameOver()) {
                    setTimeout(() => {
                        this.modalManager.showGameComplete();
                    }, 1000);
                }
            }

            } else {
                // Clear the form immediately for wrong guesses
                this.form.reset();
                
                // Add strike and check if max strikes reached
                const maxStrikesReached = this.game.addStrike();
                
                if (maxStrikesReached) {
                    // Disable the form to prevent further guesses
                    const inputElement = this.form.elements[0];
                    const submitButton = this.form.querySelector('button');
                    inputElement.disabled = true;
                    submitButton.disabled = true;
                    
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

    // Add a new method to show a message for already guessed answers
    showAlreadyGuessedMessage(answer) {
        // Create a temporary message
        const messageContainer = document.createElement("div");
        messageContainer.className = "alert alert-warning already-guessed-alert";
        messageContainer.style.position = "fixed";
        messageContainer.style.top = "20px";
        messageContainer.style.left = "50%";
        messageContainer.style.transform = "translateX(-50%)";
        messageContainer.style.zIndex = "1050";
        messageContainer.style.padding = "10px 20px";
        messageContainer.style.borderRadius = "5px";
        messageContainer.style.boxShadow = "0 4px 8px rgba(0,0,0,0.1)";
        messageContainer.textContent = `You've already guessed "${answer}"!`;
        
        // Add to the body
        document.body.appendChild(messageContainer);
        
        // Remove after a delay
        setTimeout(() => {
            messageContainer.style.opacity = "0";
            messageContainer.style.transition = "opacity 0.5s ease";
            setTimeout(() => document.body.removeChild(messageContainer), 500);
        }, 2000);
    }
    }

export default Guessing;