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

    revealAnswer(rank, answer, points) {
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
            answerText.textContent = answer;
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
}

export default UI;