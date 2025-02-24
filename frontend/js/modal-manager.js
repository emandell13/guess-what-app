class ModalManager {
    constructor(ui) {
        this.ui = ui;
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
        this.modalStrikes = document.getElementById('modalStrikes');
        this.answersSummary = document.querySelector('.answers-summary');

        // Replace onclick attributes with proper event listeners
        document.querySelectorAll('.btn-next').forEach(button => {
            button.addEventListener('click', () => this.nextStep());
        });
    }

    showGameComplete() {
        this.currentStep = 1;
        this.updateSummary();
        this.modal.show();
        this.updateProgress();
    }

    updateSummary() {
        // Update final score
        this.modalFinalScore.textContent = this.game.currentScore;

        // Update strikes display
        this.modalStrikes.innerHTML = Array(3)
            .fill()
            .map((_, i) => `<i class="fa${i < this.game.strikes ? 's' : 'r'} fa-circle me-2 ${i < this.game.strikes ? 'text-danger' : 'text-muted'}"></i>`)
            .join('');

        // Update answers summary
        this.updateAnswersSummary();
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
        [this.summaryStep, this.shareStep, this.voteStep].forEach(step => 
            step.style.display = 'none'
        );
    
        // Show current step
        switch(this.currentStep) {
            case 1:
                this.summaryStep.style.display = 'block';
                break;
            case 2:
                this.shareStep.style.display = 'block';
                break;
            case 3:
                this.voteStep.style.display = 'block';
                
                // Debug logs
                console.log("Tomorrow's question element:", document.getElementById("tomorrows-question"));
                const tomorrowsQuestion = document.getElementById("tomorrows-question").textContent;
                console.log("Tomorrow's question text:", tomorrowsQuestion);
                
                // Debug log for paragraph
                const questionHeader = this.voteStep.querySelector(".vote-container p");
                console.log("Question header paragraph:", questionHeader);
                
                if (questionHeader) {
                    questionHeader.innerHTML = `<strong>${tomorrowsQuestion}</strong><br><br>What do you think most people will answer?`;
                } else {
                    console.error("Could not find question paragraph in vote step");
                }
                
                // Debug original form
                const originalForm = document.getElementById('vote-form');
                console.log("Original vote form:", originalForm);
                
                if (originalForm) {
                    const voteForm = originalForm.cloneNode(true);
                    originalForm.style.display = 'none'; // Hide original form
                    
                    const modalVoteForm = document.getElementById('modalVoteForm');
                    console.log("Modal vote form container:", modalVoteForm);
                    
                    if (modalVoteForm) {
                        modalVoteForm.innerHTML = '';
                        modalVoteForm.appendChild(voteForm);
                    
                        // Set up submission handler
                        voteForm.addEventListener('submit', async (e) => {
                            // ...submission code...
                        });
                    } else {
                        console.error("Could not find modalVoteForm element");
                    }
                } else {
                    console.error("Could not find original vote form");
                }
                break;
        }
    
        this.updateProgress();
    }

    updateProgress() {
        this.progressBar.style.width = `${(this.currentStep / 3) * 100}%`;
    }
}

export default ModalManager;