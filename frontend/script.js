document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("guess-form");
    const responseDiv = document.getElementById("response");
    const questionDiv = document.getElementById("question");
    const topGuessesDiv = document.getElementById("top-guesses");

    // Define an async function to fetch the question and handle the form submission
    const fetchQuestion = async () => {
        try {
            // Fetch the question from the backend
            const questionResponse = await fetch("/question");
            const questionData = await questionResponse.json();
            questionDiv.textContent = questionData.question; // Display the question on the page
        } catch (error) {
            console.error("Error fetching question:", error);
            responseDiv.textContent = "Failed to load question.";
        }
    };

    // Call the async function to fetch the question when the page loads
    fetchQuestion();

    // Handle form submission
    form.addEventListener("submit", async (event) => {
        event.preventDefault(); // Prevent page reload

        const userGuess = form.elements[0].value; // Get the user's guess

        try {
            const response = await fetch("/guesses/submit", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ guess: userGuess }), // Send the guess in JSON format
            });

            const result = await response.json(); // Parse the response from the server
            responseDiv.textContent = `Server Response: ${result.message}`; // Show the server's response

             // Display the top guesses
             topGuessesDiv.textContent = `Top guesses: ${result.topGuesses.join(", ")}`;

        } catch (error) {
            console.error("Error:", error);
            responseDiv.textContent = "An error occurred. Please try again."; // Show error message
        }

        form.reset(); // Reset the form after submission
    });
});