import SummaryStep from './SummaryStep.js';
import VoteStep from './VoteStep.js';
import ShareStep from './ShareStep.js';

/**
 * Component representing the game completion modal
 */
class GameModal {
  /**
   * Creates a new GameModal
   * @param {string} modalId - The ID of the modal element
   */
  constructor(modalId) {
    this.modal = new bootstrap.Modal(document.getElementById(modalId));
    this.modalElement = document.getElementById(modalId);
    this.progressBar = this.modalElement.querySelector('.progress-bar');
    this.currentStep = 1;
    
    // Initialize steps
    this.summaryStep = new SummaryStep('summaryStep', () => this.nextStep());
    this.voteStep = new VoteStep('voteStep', () => this.nextStep());
    this.shareStep = new ShareStep('shareStep');
    
    // Handle modal hidden event
    this.modalElement.addEventListener('hidden.bs.modal', () => {
      this.resetModal();
    });
  }
  
  /**
   * Shows the modal
   * @param {number} score - The final score to display
   */
  show(score) {
    this.resetModal();
    this.summaryStep.updateScore(score);
    this.modal.show();
  }
  
  /**
   * Advances to the next step
   */
  nextStep() {
    this.currentStep++;
    
    // Hide all steps
    this.summaryStep.hide();
    this.voteStep.hide();
    this.shareStep.hide();
    
    // Show current step
    switch(this.currentStep) {
      case 1:
        this.summaryStep.show();
        break;
      case 2:
        this.voteStep.show();
        break;
      case 3:
        this.shareStep.show();
        break;
    }
    
    this.updateProgress();
  }
  
  /**
   * Updates the progress bar
   */
  updateProgress() {
    this.progressBar.style.width = `${(this.currentStep / 3) * 100}%`;
  }
  
  /**
   * Resets the modal to its initial state
   */
  resetModal() {
    this.currentStep = 1;
    this.updateProgress();
    
    // Hide vote and share steps, show summary step
    this.voteStep.hide();
    this.shareStep.hide();
    this.summaryStep.show();
  }
}

export default GameModal;