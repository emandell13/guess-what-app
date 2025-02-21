document.addEventListener("DOMContentLoaded", () => {
    // Guessing elements
    const guessForm = document.getElementById("guess-form");
    const guessResponse = document.getElementById("guess-response");
    const todaysQuestion = document.getElementById("todays-question");
    const correctGuessesDiv = document.getElementById("correct-guesses");
    const remainingGuessesDiv = document.getElementById("remaining-guesses");

    // Voting elements
    const voteForm = document.getElementById("vote-form");
    const voteResponse = document.getElementById("vote-response");
    const tomorrowsQuestion = document.getElementById("tomorrows-question");

    let correctGuesses = [];
    const MAX_GUESSES = 10;
    let guessesRemaining = MAX_GUESSES;

    // Get today's question for guessing
    const fetchTodaysQuestion = async () => {
        try {
            const response = await fetch("/guesses/question");
            const data = await response.json();
            
            if (data.question) {
                todaysQuestion.textContent = data.question;
                updateRemainingGuesses();
            } else {
                guessResponse.textContent = "No question available for guessing yet";
            }
        } catch (error) {
            console.error("Error fetching today's question:", error);
            guessResponse.textContent = "Failed to load question";
        }
    };

    // Get tomorrow's question for voting
    const fetchTomorrowsQuestion = async () => {
        try {
            const response = await fetch("/votes/question");
            const data = await response.json();
            
            if (data.question) {
                tomorrowsQuestion.textContent = data.question.question_text;
            } else {
                voteResponse.textContent = "No question available for voting";
            }
        } catch (error) {
            console.error("Error fetching tomorrow's question:", error);
            voteResponse.textContent = "Failed to load question";
        }
    };

    const updateRemainingGuesses = () => {
        remainingGuessesDiv.textContent = `Guesses remaining: ${guessesRemaining}`;
    };

    // Handle guess submission
    guessForm.addEventListener("submit", async (event) => {
        event.preventDefault();
    
        if (guessesRemaining <= 0) {
            guessResponse.textContent = "No more guesses remaining!";
            // Show voting section when out of guesses
            document.getElementById("voting-section").style.display = "block";
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
                guessResponse.textContent = `Correct! This was answer #${result.rank}`;
                correctGuesses.push({ guess: userGuess, rank: result.rank });
                correctGuesses.sort((a, b) => a.rank - b.rank);
                correctGuessesDiv.innerHTML = "Correct guesses:<br>" + 
                    correctGuesses.map(g => `#${g.rank}: ${g.guess}`).join('<br>');
                
                // Show voting section if all answers found
                if (correctGuesses.length === 5) {
                    document.getElementById("voting-section").style.display = "block";
                }
            } else {
                guessResponse.textContent = "Try again!";
                guessesRemaining--;
                updateRemainingGuesses();
                
                // Show voting section if out of guesses
                if (guessesRemaining <= 0) {
                    document.getElementById("voting-section").style.display = "block";
                }
            }
    
        } catch (error) {
            console.error("Error:", error);
            guessResponse.textContent = "An error occurred. Please try again.";
        }
    
        guessForm.reset();
    });

    // Handle vote submission
    voteForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const userResponse = voteForm.elements[0].value;

        try {
            const response = await fetch("/votes", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ response: userResponse }),
            });

            const result = await response.json();

            if (response.ok) {
                voteResponse.textContent = "Thank you for your vote!";
                voteResponse.className = "text-green-600";
            } else {
                voteResponse.textContent = result.error || "Failed to submit vote";
                voteResponse.className = "text-red-600";
            }

        } catch (error) {
            console.error("Error:", error);
            voteResponse.textContent = "An error occurred. Please try again.";
            voteResponse.className = "text-red-600";
        }

        voteForm.reset();
    });

    // Initialize
    fetchTodaysQuestion();
    fetchTomorrowsQuestion();
});