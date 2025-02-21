document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("vote-form");
    const responseDiv = document.getElementById("response");
    const questionDiv = document.getElementById("question");
    const topGuessesDiv = document.getElementById("top-guesses");

   // Get tomorrow's voting question
   const fetchQuestion = async () => {
    try {
        const questionResponse = await fetch("/votes/question");
        const questionData = await questionResponse.json();
        
        if (questionData.question) {
            questionDiv.textContent = questionData.question.question_text;
            // Add a label to show this is tomorrow's question
            const phaseLabel = document.createElement("p");
            phaseLabel.textContent = "Vote for tomorrow's question!";
            phaseLabel.className = "text-blue-600 font-bold";
            questionDiv.parentNode.insertBefore(phaseLabel, questionDiv);
        } else {
            responseDiv.textContent = "No question available for voting";
        }
    } catch (error) {
        console.error("Error fetching question:", error);
        responseDiv.textContent = "Failed to load question.";
    }
};

    // Call fetchQuestion when page loads
    fetchQuestion();

    // Handle form submission
    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const userResponse = form.elements[0].value;

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
                responseDiv.textContent = "Thank you for your vote!";
                responseDiv.className = "text-green-600";
            } else {
                responseDiv.textContent = result.error || "Failed to submit vote";
                responseDiv.className = "text-red-600";
            }

        } catch (error) {
            console.error("Error:", error);
            responseDiv.textContent = "An error occurred. Please try again.";
            responseDiv.className = "text-red-600";
        }

        form.reset();
    });
});