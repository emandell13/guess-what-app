// frontend/js/components/modal/GameModal.js

import SummaryStep from './SummaryStep.js';
import VoteStep from './VoteStep.js';
import ShareStep from './ShareStep.js';
import eventService from '../../services/EventService.js';

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
    
    // Initialize steps with no callback dependencies
    this.summaryStep = new SummaryStep('summaryStep');
    this.voteStep = new VoteStep('voteStep');
    this.shareStep = new ShareStep('shareStep');
    
    // Handle modal hidden event
    this.modalElement.addEventListener('hidden.bs.modal', () => {
      this.resetModal();
    });
    
    // Listen for events
    this.setupEventListeners();
  }
  
  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Listen for game completed event
    eventService.on('game:completed', (event) => {
      const { currentScore } = event.detail;
      this.show(currentScore);
    });
    
    // Listen for step navigation events
    eventService.on('modal:next-step', (event) => {
      this.nextStep();
    });
  }
  
  /**
   * Shows the modal
   * @param {number} score - The final score to display
   */
  show(score) {
    this.resetModal();
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
        eventService.emit('modal:step-changed', { step: 'summary' });
        break;
      case 2:
        this.voteStep.show();
        eventService.emit('modal:step-changed', { step: 'vote' });
        break;
      case 3:
        this.shareStep.show();
        eventService.emit('modal:step-changed', { step: 'share' });
        break;
    }
    
    this.updateProgress();
  }
  
  /**
   * Updates the progress bar
   */
  updateProgress() {
    const segments = this.modalElement.querySelectorAll('.progress-segments .segment');
    
    // Update segments based on current step
    segments.forEach((segment, index) => {
      if (index < this.currentStep) {
        segment.classList.add('filled');
        segment.classList.remove('empty');
      } else {
        segment.classList.add('empty');
        segment.classList.remove('filled');
      }
    });
    
    // Emit progress update event
    eventService.emit('modal:progress-updated', {
      step: this.currentStep,
      totalSteps: 3,
      percent: (this.currentStep / 3) * 100
    });
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
    
    // Emit reset event
    eventService.emit('modal:reset');
  }
}

export default GameModal;