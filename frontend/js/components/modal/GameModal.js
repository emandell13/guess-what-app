// frontend/js/components/modal/GameModal.js

import SummaryStep from './SummaryStep.js';
import VoteStep from './VoteStep.js';
import PickFavoriteStep from './PickFavoriteStep.js';
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
    this.pickStep = new PickFavoriteStep('pickStep');
    this.shareStep = new ShareStep('shareStep');

    // Handle modal hidden event
    this.modalElement.addEventListener('hidden.bs.modal', () => {
      this.resetModal();
    });

    // Listen for events
    this.setupEventListeners();

    // Mobile bottom-sheet swipe-to-dismiss (no-op on desktop)
    this.setupSwipeToDismiss();
  }

  /**
   * Enables swipe-down-to-dismiss on the mobile bottom sheet.
   *
   * Only active under the @media (max-width: 767.98px) breakpoint where
   * modal.css reshapes #gameCompleteModal into a bottom sheet. The drag
   * zone is the grab handle + modal header — touches inside .modal-body
   * pass through so step content can scroll normally.
   *
   * During a drag, the dialog's transform tracks the finger 1:1 (only
   * downward movement is allowed). On release, if the drag exceeded
   * DISMISS_THRESHOLD the sheet animates off-screen and the Bootstrap
   * modal is hidden; otherwise it springs back to rest.
   */
  setupSwipeToDismiss() {
    if (!window.matchMedia('(max-width: 767.98px)').matches) return;

    const dialog = this.modalElement.querySelector('.modal-dialog');
    const handle = this.modalElement.querySelector('.sheet-grab');
    const header = this.modalElement.querySelector('.modal-header');
    if (!dialog || !handle) return;

    // Pixels past which a release dismisses instead of snapping back.
    const DISMISS_THRESHOLD = 100;
    // Ignore tiny jitter so taps on the close button don't feel draggy.
    const DRAG_ACTIVATION = 4;

    let startY = null;
    let dragY = 0;
    let dragging = false;

    const resetDialogStyles = () => {
      dialog.style.transform = '';
      dialog.style.transition = '';
      this.modalElement.classList.remove('sheet-dragging');
    };

    const onStart = (e) => {
      if (startY !== null) return;
      if (!e.touches || e.touches.length !== 1) return;
      // Don't start a drag when the press originates from an interactive
      // element (close button, etc.) — let the click fire cleanly.
      const target = e.target;
      if (target && target.closest && target.closest('button, a, input')) return;

      startY = e.touches[0].clientY;
      dragY = 0;
      dragging = false;
    };

    const onMove = (e) => {
      if (startY === null) return;
      const touch = e.touches[0];
      const delta = Math.max(0, touch.clientY - startY);
      dragY = delta;

      if (!dragging && delta > DRAG_ACTIVATION) {
        dragging = true;
        this.modalElement.classList.add('sheet-dragging');
      }

      if (dragging) {
        // preventDefault stops iOS from rubber-band-scrolling the page
        // while the user is dragging the sheet.
        e.preventDefault();
        dialog.style.transform = `translateY(${dragY}px)`;
      }
    };

    const onEnd = () => {
      if (startY === null) return;
      const wasDragging = dragging;
      const finalY = dragY;
      startY = null;
      dragY = 0;
      dragging = false;

      if (!wasDragging) {
        // Never activated — nothing to animate back.
        resetDialogStyles();
        return;
      }

      if (finalY > DISMISS_THRESHOLD) {
        // Finish the slide off-screen, then let Bootstrap hide the modal.
        // Keep sheet-dragging off so the CSS transition applies.
        this.modalElement.classList.remove('sheet-dragging');
        dialog.style.transition = 'transform 0.22s ease-out';
        dialog.style.transform = 'translateY(100%)';
        let finished = false;
        const finish = () => {
          if (finished) return;
          finished = true;
          dialog.removeEventListener('transitionend', finish);
          resetDialogStyles();
          this.modal.hide();
        };
        dialog.addEventListener('transitionend', finish);
        // Safety fallback if transitionend doesn't fire.
        setTimeout(finish, 280);
      } else {
        // Snap back to rest.
        this.modalElement.classList.remove('sheet-dragging');
        dialog.style.transition = 'transform 0.22s ease-out';
        dialog.style.transform = '';
        setTimeout(() => { dialog.style.transition = ''; }, 250);
      }
    };

    // Attach to grab handle + header only. Touches inside .modal-body
    // bubble up, but we bail in onStart if they start on an interactive
    // element; vertical scroll inside the body is unaffected because
    // we don't preventDefault unless a drag activates here.
    [handle, header].forEach((el) => {
      if (!el) return;
      el.addEventListener('touchstart', onStart, { passive: true });
      el.addEventListener('touchmove', onMove, { passive: false });
      el.addEventListener('touchend', onEnd);
      el.addEventListener('touchcancel', onEnd);
    });
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
    this.pickStep.hide();
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
        this.pickStep.show();
        eventService.emit('modal:step-changed', { step: 'pick' });
        break;
      case 4:
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
    this.pickStep.hide();
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
      totalSteps: 4,
      percent: (this.currentStep / 4) * 100
    });
  }

  resetModal() {
    try {
      this.currentStep = 1;
      this.updateProgress();

      console.log('GameModal.resetModal - Before calling summaryStep.show, gaveUp state:', this.gaveUp);

      // Hide non-summary steps
      this.voteStep.hide();
      this.pickStep.hide();
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

      // Clear any lingering inline transform/transition left by a
      // swipe-to-dismiss gesture so the next open animates cleanly.
      const dialog = this.modalElement.querySelector('.modal-dialog');
      if (dialog) {
        dialog.style.transform = '';
        dialog.style.transition = '';
      }
      this.modalElement.classList.remove('sheet-dragging');
  
      // Emit reset event
      eventService.emit('modal:reset');
    } catch (error) {
      console.error("Error in resetModal:", error);
    }
  }
  
  
}

export default GameModal;