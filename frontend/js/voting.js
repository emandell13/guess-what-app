class Voting {
    constructor(game) {
        this.game = game;
        this.form = document.getElementById("vote-form");
        this.responseDiv = document.getElementById("vote-response");
        this.setupEventListeners();
    }

    setupEventListeners() {
        this.form.addEventListener("submit", async (event) => {
            event.preventDefault();
            await this.handleVote(event);
        });
    }

    async handleVote() {
        const userResponse = this.form.elements[0].value;

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
                this.responseDiv.textContent = "Thank you for your vote!";
                this.responseDiv.className = "text-green-600";
            } else {
                this.responseDiv.textContent = result.error || "Failed to submit vote";
                this.responseDiv.className = "text-red-600";
            }

        } catch (error) {
            console.error("Error:", error);
            this.responseDiv.textContent = "An error occurred. Please try again.";
            this.responseDiv.className = "text-red-600";
        }

        this.form.reset();
    }
}

export default Voting;