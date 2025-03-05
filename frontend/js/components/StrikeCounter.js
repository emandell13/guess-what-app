import { strikeReveal } from '../utils/animationUtils.js';

/**
 * Component representing the strike counter
 */
class StrikeCounter {
  /**
   * Creates a new StrikeCounter
   * @param {string} strikesId - The ID of the strikes container element
   * @param {number} maxStrikes - The maximum number of strikes
   */
  constructor(strikesId, maxStrikes = 3) {
    this.strikesContainer = document.getElementById(strikesId);
    this.maxStrikes = maxStrikes;
    this.initialize();
  }
  
  /**
   * Initializes the strike counter display
   */
  initialize() {
    this.strikesContainer.innerHTML = Array(this.maxStrikes)
      .fill()
      .map(() => `<i class="far fa-circle me-3 text-danger opacity-75"></i>`)
      .join('');
  }
  
  /**
   * Updates the strike display to show a specific number of strikes
   * @param {number} strikeCount - The number of strikes to display
   * @param {boolean} animate - Whether to animate the last strike
   */
  updateStrikes(strikeCount, animate = true) {
    const strikeIcons = this.strikesContainer.querySelectorAll('i');
    
    for (let i = 0; i < this.maxStrikes; i++) {
      const icon = strikeIcons[i];
      if (i < strikeCount) {
        icon.classList.replace('far', 'fas');
        
        // Animate the last added strike if requested
        if (animate && i === strikeCount - 1) {
          strikeReveal(icon);
        }
      } else {
        icon.classList.replace('fas', 'far');
      }
    }
  }
}

export default StrikeCounter;