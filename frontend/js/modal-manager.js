import { hasVotedForTomorrow } from './utils/sessionUtils.js';

class ModalManager {
    constructor(ui, voting) {
        this.ui = ui;
        this.voting = voting;
        this.game = null; // Will be set later
        this.currentStep = 1;
        this.modal = new bootstrap.Modal(document.getElementById('gameCompleteModal'));
        this.setupModalElements();
    }

    setGame(game) {
        this.game = game;
    }

    setupModalElements() {
        // Cache DOM elements
        this.progressBar = document.querySelector('.progress-bar');
        this.summaryStep = document.getElementById('summaryStep');
        this.shareStep = document.getElementById('shareStep');
        this.voteStep = document.getElementById('voteStep');
        this.modalFinalScore = document.getElementById('modalFinalScore');
        this.modalStrikes = this.shareStep.querySelector('#modalStrikes');
        this.answersSummary = this.shareStep.querySelector('.answers-summary');
        this.modalVoteForm = document.getElementById('modalVoteForm');
    
        // Replace onclick attributes with proper event listeners
        document.querySelectorAll('.btn-next').forEach(button => {
            button.addEventListener('click', () => this.nextStep());
        });
    }

    showGameComplete() {
        console.log("Showing game complete modal");
        this.currentStep = 1;
        this.updateSummary();
        this.modal.show();
        this.updateProgress();
    }

    updateSummary() {
        // Check if game is set
        if (!this.game) {
            console.error("Game not set in ModalManager");
            return;
        }

        // Update final score
        this.modalFinalScore.textContent = this.game.currentScore;
    }

    async updateAnswersSummary() {
        try {
            // Fetch all answers
            const response = await fetch("/guesses/question?includeAnswers=true");
            const data = await response.json();
            
            // Clear existing answers
            this.answersSummary.innerHTML = '';

            // Add each answer card
            data.answers.forEach(answer => {
                const wasGuessed = this.game.correctGuesses.some(guess => 
                    guess.rank === answer.rank
                );

                const card = document.createElement('div');
                card.className = `answer-card ${wasGuessed ? 'correct' : 'revealed'}`;
                card.innerHTML = `
                    <div class="answer-content">
                        <strong>#${answer.rank}</strong> ${answer.answer}
                    </div>
                    <div class="answer-points">
                        ${answer.points} pts
                    </div>
                `;
                this.answersSummary.appendChild(card);
            });
        } catch (error) {
            console.error('Error updating answers summary:', error);
        }
    }

    nextStep() {
        this.currentStep++;
        
        // Hide all steps
        [this.summaryStep, this.voteStep, this.shareStep].forEach(step => 
            step.style.display = 'none'
        );
    
        // Show current step
        switch(this.currentStep) {
            case 1:
                this.summaryStep.style.display = 'block';
                break;
            case 2:
                this.voteStep.style.display = 'block';
                
                // Check if voting is available
                if (!this.voting) {
                    console.error("Voting not available");
                    this.modalVoteForm.innerHTML = `
                        <div class="alert alert-danger">
                            Voting is not available at this time.
                        </div>
                    `;
                    break;
                }
                
                // Get tomorrow's question from the voting component
                const tomorrowsQuestion = this.voting.tomorrowsQuestionText || "Tomorrow's question";
                
                console.log("Using tomorrow's question in modal:", tomorrowsQuestion);
                
                // Update the question text
                const questionHeader = this.voteStep.querySelector(".vote-container p");
                if (questionHeader) {
                    questionHeader.innerHTML = `<strong>${tomorrowsQuestion}</strong><br>`;
                }
                
                // Check if user has already voted
                if (hasVotedForTomorrow()) {
                    // Show already voted message
                    this.modalVoteForm.innerHTML = `
                        <div class="alert alert-info">
                            You've already voted for tomorrow's question. Come back tomorrow to play again!
                        </div>
                    `;
                } else {
                    // Create a new voting form
                    this.modalVoteForm.innerHTML = `
                        <form id="modal-vote-form" class="mt-3">
                            <div class="input-group">
                                <input type="text" class="form-control" placeholder="Enter your response" required>
                                <button class="btn btn-primary" type="submit">Submit Vote</button>
                            </div>
                        </form>
                    `;
    
                    // Add event listener to the newly created form
                    const modalVoteForm = document.getElementById("modal-vote-form");
                    if (modalVoteForm) {
                        modalVoteForm.addEventListener('submit', async (e) => {
                            e.preventDefault();
                            const userResponse = e.target.elements[0].value;
                            
                            try {
                                // Use the voting service to submit vote
                                const result = await this.voting.submitVote(userResponse);
                                
                                // Create response message element
                                const responseMsg = document.createElement('div');
                                responseMsg.className = result.success ? 'alert alert-success mt-3' : 'alert alert-danger mt-3';
                                responseMsg.textContent = result.message;
                                
                                // Clear any previous response
                                const existingResponse = this.modalVoteForm.querySelector('.alert');
                                if (existingResponse) {
                                    existingResponse.remove();
                                }
                                
                                // Add response message
                                this.modalVoteForm.appendChild(responseMsg);
                                
                                // Hide form on success
                                if (result.success) {
                                    modalVoteForm.style.display = 'none';
                                }
                            } catch (error) {
                                console.error("Error submitting vote:", error);
                                
                                // Show error message
                                const errorMsg = document.createElement('div');
                                errorMsg.className = 'alert alert-danger mt-3';
                                errorMsg.textContent = "An error occurred while submitting your vote.";
                                
                                // Clear any previous response
                                const existingResponse = this.modalVoteForm.querySelector('.alert');
                                if (existingResponse) {
                                    existingResponse.remove();
                                }
                                
                                this.modalVoteForm.appendChild(errorMsg);
                            }
                        });
                    }
                }
                break;
            case 3:
                this.shareStep.style.display = 'block';
                
                // Update strikes display
                this.modalStrikes.innerHTML = Array(3)
                    .fill()
                    .map((_, i) => `<i class="fa${i < this.game.strikes ? 's' : 'r'} fa-circle me-2 ${i < this.game.strikes ? 'text-danger' : 'text-muted'}"></i>`)
                    .join('');
    
                // Update answers summary
                this.updateAnswersSummary();
                break;
        }
    
        this.updateProgress();
    }

    updateProgress() {
        this.progressBar.style.width = `${(this.currentStep / 3) * 100}%`;
    }
}

export default ModalManager;