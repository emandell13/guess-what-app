import { getSessionId, hasVotedForTomorrow, markTomorrowVoted } from './utils/sessionUtils.js';

class Voting {
    constructor() {
        this.tomorrowsQuestionText = null;
    }

    // The main voting function that can be called from anywhere
    async submitVote(userResponse) {
        try {
            // Check if user has already voted for tomorrow
            if (hasVotedForTomorrow()) {
                return {
                    success: false,
                    message: "You've already voted for tomorrow's question!"
                };
            }
            
            // Include the session ID with the vote
            const sessionId = getSessionId();
            
            const response = await fetch("/votes", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ 
                    response: userResponse,
                    sessionId: sessionId
                }),
            });

            const result = await response.json();
            
            // If successful, mark that the user has voted
            if (response.ok) {
                markTomorrowVoted();
            }
            
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

    // Fetch tomorrow's question text
    async fetchTomorrowsQuestion() {
        try {
            const response = await fetch("/votes/question");
            const data = await response.json();
            
            if (data.question) {
                this.tomorrowsQuestionText = data.question.question_text;
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
}

export default Voting;