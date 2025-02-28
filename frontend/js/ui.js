class UI {
    constructor() {
        // Cache DOM elements
        this.answerBoxesContainer = document.getElementById("answer-boxes");
    }

    createAnswerBoxes(count) {
        this.answerBoxesContainer.innerHTML = '';
        for (let i = 1; i <= count; i++) {
            const answerBox = document.createElement("div");
            answerBox.className = "col-12 mb-2";
            answerBox.id = `answer-${i}`;
            answerBox.innerHTML = `
                <div class="d-flex align-items-center gap-3">
                    <h4 class="mb-0">#${i}</h4>
                    <div class="card flex-grow-1">
                        <div class="card-body d-flex justify-content-between align-items-center py-3 bg-light" style="min-height: 60px">
                            <span class="answer-text flex-grow-1 text-center h5 mb-0"></span>
                            <span class="points badge d-none">0 pts</span>
                        </div>
                    </div>
                </div>
            `;
            this.answerBoxesContainer.appendChild(answerBox);
        }
    }

    revealAnswer(rank, answer, points, canonicalAnswer) {
        const answerBox = document.getElementById(`answer-${rank}`);
        const cardBody = answerBox.querySelector(".card-body");
        const answerText = answerBox.querySelector(".answer-text");
        const pointsBadge = answerBox.querySelector(".points");
        
        // Start with empty text
        answerText.textContent = "";
        
        // Add animation class
        cardBody.classList.add("answer-reveal");

        // Show the text halfway through the flip
        setTimeout(() => {
            answerText.textContent = canonicalAnswer || answer;
            answerText.classList.add('visible');
            pointsBadge.textContent = `${points} pts`;
            pointsBadge.classList.remove("d-none");
            cardBody.classList.remove("bg-light");
            cardBody.classList.add("bg-success", "bg-opacity-25");
        }, 1000);

        // Remove animation class after completion
        setTimeout(() => {
            cardBody.classList.remove("answer-reveal");
        }, 2000);
    }

    revealUnguessedAnswer(rank, answer, points, isStrikeout = true) {
        const answerBox = document.getElementById(`answer-${rank}`);
        const cardBody = answerBox.querySelector(".card-body");
        const answerText = answerBox.querySelector(".answer-text");
        const pointsBadge = answerBox.querySelector(".points");
        
        // Start with empty text
        answerText.textContent = "";
        
        // Add strikeout reveal animation
        cardBody.classList.add("answer-reveal", "strikeout-reveal");

        // Show the text halfway through the flip
        setTimeout(() => {
            answerText.textContent = answer;
            answerText.classList.add('visible');
            pointsBadge.textContent = `${points} pts`;
            pointsBadge.classList.remove("d-none");
            cardBody.classList.remove("bg-light");
            cardBody.classList.add("bg-danger", "bg-opacity-25"); // Red background for strikeout reveals
        }, 1000);

        // Remove animation class after completion
        setTimeout(() => {
            cardBody.classList.remove("answer-reveal", "strikeout-reveal");
        }, 2000);
    }

    async revealAllRemaining(game) {
        try {
            const response = await fetch("/guesses/question?includeAnswers=true");
            const data = await response.json();
            
            // Filter out already guessed answers
            const remainingAnswers = data.answers.filter(answer => 
                !game.correctGuesses.some(guess => guess.rank === answer.rank)
            );
    
            // Calculate total reveal time
            const totalRevealTime = remainingAnswers.length * 2500;
            
            // Reveal each remaining answer with a delay between each
            remainingAnswers.forEach((answer, index) => {
                setTimeout(() => {
                    this.revealUnguessedAnswer(answer.rank, answer.answer, answer.points);
                }, index * 2500); // Stagger the reveals
            });
            
            // Return a promise that resolves when all reveals are complete
            return new Promise(resolve => setTimeout(resolve, totalRevealTime));
        } catch (error) {
            console.error('Error fetching all answers:', error);
            return Promise.resolve(); // Resolve immediately on error
        }
    }
}

export default UI;