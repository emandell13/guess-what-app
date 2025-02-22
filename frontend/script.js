document.addEventListener("DOMContentLoaded", () => {
    // Existing form elements
    const guessForm = document.getElementById("guess-form");
    const voteForm = document.getElementById("vote-form");
    const voteResponse = document.getElementById("vote-response");
    const tomorrowsQuestion = document.getElementById("tomorrows-question");

    // New elements for updated UI
    const answerBoxesContainer = document.getElementById("answer-boxes");
    const currentScoreSpan = document.getElementById("current-score");
    const maxScoreSpan = document.getElementById("max-score");
    const strikesDiv = document.getElementById("strikes");

    // Game state
    let correctGuesses = [];
    let maxPoints = 0;
    let currentScore = 0;
    let strikes = 0;
    const MAX_STRIKES = 3;

    // Get today's question for guessing
    const fetchTodaysQuestion = async () => {
        try {
            const response = await fetch("/guesses/question");
            const data = await response.json();
            
            if (data.question) {
                // Set the question text with vote count
                document.querySelector("h2").textContent = 
                    `Guess what ${data.totalVotes} people said was ${data.question}!`;
                
                // Set max score
                maxPoints = data.maxPoints;
                maxScoreSpan.textContent = maxPoints;
                
                // Create answer boxes
                createAnswerBoxes(data.answerCount);
            } else {
                document.querySelector("h2").textContent = "No question available for guessing yet";
            }
        } catch (error) {
            console.error("Error fetching today's question:", error);
        }
    };

    const createAnswerBoxes = (count) => {
        answerBoxesContainer.innerHTML = '';
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
            answerBoxesContainer.appendChild(answerBox);
        }
    };

    const addStrike = () => {
        strikes++;
        const strikeIcons = strikesDiv.querySelectorAll('i');
        const icon = strikeIcons[strikes - 1];
        icon.classList.replace('far', 'fas');
        icon.classList.add('text-danger', 'strike-reveal');
        
        if (strikes >= MAX_STRIKES) {
            showVotingSection();
        }
    };

    const showVotingSection = () => {
        document.getElementById("voting-section").style.display = "block";
    };

    // Handle guess submission
    guessForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        if (strikes >= MAX_STRIKES) {
            showVotingSection();
            return;
        }

        const userGuess = guessForm.elements[0].value;

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
                const answerBox = document.getElementById(`answer-${result.rank}`);
                const cardBody = answerBox.querySelector(".card-body");
                const pointsBadge = answerBox.querySelector(".points");
                
                answerBox.querySelector(".answer-text").textContent = userGuess;
                pointsBadge.textContent = `${result.points} pts`;
                pointsBadge.classList.remove("d-none");
                
                // Add animation class
                console.log("Adding animation class"); // Debug log
                cardBody.classList.add("answer-reveal");
                console.log("Card body classes:", cardBody.classList); // Debug log

                cardBody.classList.remove("bg-light");
                cardBody.classList.add("bg-success", "bg-opacity-25");

                // Remove animation class after it completes
                setTimeout(() => {
                    cardBody.classList.remove("answer-reveal");
                }, 500);

                // Update score
                currentScore += result.points;
                currentScoreSpan.textContent = currentScore;
                
                correctGuesses.push({ guess: userGuess, rank: result.rank });
                
                // Show voting section if all answers found
                if (correctGuesses.length === 5) {
                    showVotingSection();
                }
            } else {
                addStrike();
            }

        } catch (error) {
            console.error("Error:", error);
        }

        guessForm.reset();
    });

    // Keep your existing vote submission handler
    voteForm.addEventListener("submit", async (event) => {
        // ... your existing vote submission code ...
    });

    // Initialize game
    fetchTodaysQuestion();
    fetchTomorrowsQuestion();
});