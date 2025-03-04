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
        event.preventDefault();
        
        // Check if game is already over before proceeding
        if (this.game.isGameOver()) {
            this.modalManager.showGameComplete();
            return;
        }
    
        const userGuess = this.form.elements[0].value;
        if (!userGuess.trim()) return;  // Don't submit empty guesses
    
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
                    this.showAlreadyGuessedMessage(result.canonicalAnswer || userGuess);
                } else {
                    // Reveal answer with animation
                    this.ui.revealAnswer(result.rank, userGuess, result.points, result.canonicalAnswer);
                    
                    // Record correct guess
                    this.game.recordCorrectGuess(
                        userGuess,
                        result.rank,
                        result.points,
                        result.canonicalAnswer
                    );
                }
            } else {
                // Add strike for incorrect guess
                this.game.addStrike();
                
                // If this strike maxed us out, reveal all remaining answers
                if (this.game.strikes >= this.game.MAX_STRIKES) {
                    await this.ui.revealAllRemaining(this.game);
                }
            }
    
            // Check if game is over after this guess (centralized check)
            if (this.game.isGameOver()) {
                // Disable form
                this.disableGuessForm();
                
                // Allow time for UI updates, then show completion modal
                setTimeout(() => {
                    this.modalManager.showGameComplete();
                }, 1000);
            }
    
        } catch (error) {
            console.error("Error:", error);
        }
    
        this.form.reset();
    }
    
    // Add this helper method to centralize form disabling
    disableGuessForm() {
        const inputElement = this.form.elements[0];
        const submitButton = this.form.querySelector('button');
        
        if (inputElement) inputElement.disabled = true;
        if (submitButton) submitButton.disabled = true;
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