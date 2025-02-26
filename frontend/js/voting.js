class Voting {
    constructor(game) {
        this.game = game;
        // We'll keep this class focused on the voting functionality
        // but remove direct references to specific DOM elements
    }

    // The main voting function that can be called from anywhere
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