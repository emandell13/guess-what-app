class ModalManager {
    constructor(game, ui) {
        this.game = game;
        this.ui = ui;
        this.currentStep = 1;
        this.modal = new bootstrap.Modal(document.getElementById('gameCompleteModal'));
        this.setupModalElements();
    }

    setupModalElements() {
        // Cache DOM elements
        this.progressBar = document.querySelector('.progress-bar');
        this.summaryStep = document.getElementById('summaryStep');
        this.shareStep = document.getElementById('shareStep');
        this.voteStep = document.getElementById('voteStep');
        this.modalFinalScore = document.getElementById('modalFinalScore');
        this.modalStrikes = document.getElementById('modalStrikes');

        // Set up navigation buttons
        const nextButtons = document.querySelectorAll('[onclick="nextStep()"]');
        nextButtons.forEach(button => {
            button.onclick = () => this.nextStep();
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
            .map((_, i) => `<i class="fa${i < this.game.strikes ? 's' : 'r'} fa-circle me-2 ${i < this.game.strikes ? 'text-danger' : ''}"></i>`)
            .join('');
    }

    nextStep() {
        this.currentStep++;
        this.updateProgress();
        
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
                // Move vote form into modal
                const voteForm = document.getElementById('vote-form').cloneNode(true);
                this.voteStep.querySelector('#modalVoteForm').innerHTML = '';
                this.voteStep.querySelector('#modalVoteForm').appendChild(voteForm);
                break;
        }
    }

    updateProgress() {
        this.progressBar.style.width = `${(this.currentStep / 3) * 100}%`;
    }
}

export default ModalManager;