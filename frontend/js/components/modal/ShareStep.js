// frontend/js/components/modal/ShareStep.js

import eventService from '../../services/EventService.js';

/**
 * Component representing the simplified social follow step
 */
class ShareStep {
  /**
   * Creates a new ShareStep
   * @param {string} stepId - The ID of the step element
   */
  constructor(stepId) {
    this.stepElement = document.getElementById(stepId);
  }

  /**
   * Shows this step
   */
  show() {
    this.stepElement.style.display = 'block';
    
    // Emit event when step is shown
    eventService.emit('share:shown', {});
  }

  /**
   * Hides this step
   */
  hide() {
    this.stepElement.style.display = 'none';
  }
}

export default ShareStep;