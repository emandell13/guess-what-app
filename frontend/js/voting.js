class Voting {
    constructor() {
        // Property to store tomorrow's question
        this.tomorrowsQuestionText = null;
    }

    // Method to fetch tomorrow's question
    async fetchTomorrowsQuestion() {
        try {
            const response = await fetch("/votes/question");
            const data = await response.json();
            
            if (data.question) {
                this.tomorrowsQuestionText = data.question.question_text;
                
                // Update DOM element if it exists (optional)
                const tomorrowsQuestion = document.getElementById("tomorrows-question");
                if (tomorrowsQuestion) {
                    tomorrowsQuestion.textContent = data.question.question_text;
                }
                
                return data.question.question_text;
            } else {
                this.tomorrowsQuestionText = "No question available";
                return null;
            }
        } catch (error) {
            console.error("Error fetching tomorrow's question:", error);
            this.tomorrowsQuestionText = "Error loading question";
            return null;
        }
    }

    // The voting function
    async submitVote(userResponse) {
        try {
            const response = await fetch("/votes", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ response: userResponse }),
            });

            const result = await response.json();
            
            return {
                success: response.ok,
                message: response.ok ? "Thank you for your vote!" : (result.error || "Failed to submit vote"),
                data: result
            };
        } catch (error) {
            console.error("Error:", error);
            return {
                success: false,
                message: "An error occurred. Please try again."
            };
        }
    }
}

export default Voting;