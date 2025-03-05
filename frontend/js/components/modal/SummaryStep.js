/**
 * Component representing the summary step of the game completion modal
 */
class SummaryStep {
    /**
     * Creates a new SummaryStep
     * @param {string} stepId - The ID of the step element
     * @param {function} onNext - Callback for when the next button is clicked
     */
    constructor(stepId, onNext) {
      this.stepElement = document.getElementById(stepId);
      this.scoreElement = this.stepElement.querySelector('#modalFinalScore');
      this.nextButton = this.stepElement.querySelector('.btn-next');
      
      // Set up event listener
      this.nextButton.addEventListener('click', () => {
        if (onNext) onNext();
      });
    }
    
    /**
     * Shows this step
     */
    show() {
      this.stepElement.style.display = 'block';
    }
    
    /**
     * Hides this step
     */
    hide() {
      this.stepElement.style.display = 'none';
    }
    
    /**
     * Updates the score displayed
     * @param {number} score - The score to display
     */
    updateScore(score) {
      this.scoreElement.textContent = score;
    }
  }
  
  export default SummaryStep;