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
      const { totalGuesses, gaveUp } = event.detail;
      console.log("GameModal - Received game:completed event with:", { 
        totalGuesses, 
        gaveUp,
        eventDetail: JSON.stringify(event.detail)
      });  
      // Don't automatically show the modal on game completion
      // Instead, store the information and check if we're pending animations
      this.pendingGuesses = totalGuesses;  // Changed from pendingScore to pendingGuesses
      this.pendingGaveUp = gaveUp;
    
      // If there are no pending animations, show the modal immediately
      if (document.body.dataset.revealingAnswers !== 'true') {
        console.log('No animations in progress, showing modal immediately');
        this.show(totalGuesses, gaveUp);
      } else {
        console.log('Animations in progress, modal will show when complete');
      }
    });

    // Listen for step navigation events
    eventService.on('modal:next-step', (event) => {
      this.nextStep();
    });
  }

  /**
 * Shows the modal
 * @param {number} totalGuesses - The number of guesses to display
 * @param {boolean} gaveUp - Whether the user gave up
 */
  show(totalGuesses, gaveUp) {
    console.log('GameModal.show - called with parameters', { totalGuesses, gaveUp });
  
    // If animations are in progress, don't show yet
    if (document.body.dataset.revealingAnswers === 'true') {
      // Store the data for later when animations complete
      this.pendingScore = totalGuesses;
      this.pendingGaveUp = gaveUp;
      console.log('Animations in progress, delaying modal');
      return;
    }
  
    // Store gaveUp state so it can be used when showing the summary step
    this.gaveUp = gaveUp;
    console.log('GameModal.show - Stored gaveUp state:', this.gaveUp);
    
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
    switch (this.currentStep) {
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

  goToVotingStep() {
    // Hide all steps
    this.summaryStep.hide();
    this.voteStep.hide();
    this.shareStep.hide();

    // Show only the vote step
    this.voteStep.show();

    // Don't update progress indicators in direct mode
    this.currentStep = 0; // Set to non-standard value to indicate direct access

    // Hide the skip link when in direct voting access
    const skipLink = document.querySelector('#voteStep .skip-link');
    if (skipLink) {
      skipLink.style.display = 'none';
    }

    // Emit event to signal direct voting step access
    eventService.emit('modal:direct-voting-access');
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

  resetModal() {
    try {
      this.currentStep = 1;
      this.updateProgress();

      console.log('GameModal.resetModal - Before calling summaryStep.show, gaveUp state:', this.gaveUp);
  
      // Hide vote and share steps
      this.voteStep.hide();
      this.shareStep.hide();
      
      // Show summary step with gaveUp status
      this.summaryStep.show(this.gaveUp);
      console.log('GameModal.resetModal - After calling summaryStep.show');
  
      // Make sure progress bar is visible again
      const progressContainer = document.querySelector('#gameCompleteModal .progress-container');
      if (progressContainer) {
        progressContainer.style.display = '';
      }
  
      // Reset close button positioning
      const closeButton = document.querySelector('#gameCompleteModal .btn-close');
      if (closeButton) {
        closeButton.style.position = '';
        closeButton.style.right = '';
        closeButton.style.top = '';
      }
  
      // Emit reset event
      eventService.emit('modal:reset');
    } catch (error) {
      console.error("Error in resetModal:", error);
    }
  }
  
  
}

export default GameModal;