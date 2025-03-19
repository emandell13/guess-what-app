import eventService from '../services/EventService.js';
import { strikeReveal } from '../utils/animationUtils.js';

/**
 * Component representing the strike counter
 */
class StrikeCounter {
  constructor(strikesId, maxStrikes = 3) {
    this.strikesContainer = document.getElementById(strikesId);
    this.maxStrikes = maxStrikes;
    this.initialize();

    // Listen for strike events
    eventService.on('game:strike-added', (event) => {
      const { strikes } = event.detail;
      this.updateStrikes(strikes, true);
    });
  }
  
  /**
   * Initializes the strike counter display
   */
  initialize() {
    // Create strikes with custom styling instead of Font Awesome
    this.strikesContainer.innerHTML = Array(this.maxStrikes)
      .fill()
      .map(() => `<span class="strike-circle empty"></span>`)
      .join('');
  }
  
  /**
   * Updates the strike display to show a specific number of strikes
   * @param {number} strikeCount - The number of strikes to display
   * @param {boolean} animate - Whether to animate the last strike
   */
  updateStrikes(strikeCount, animate = true) {
    const strikeElements = this.strikesContainer.querySelectorAll('.strike-circle');
    
    for (let i = 0; i < this.maxStrikes; i++) {
      const element = strikeElements[i];
      if (i < strikeCount) {
        element.classList.remove('empty');
        element.classList.add('filled');
        
        // Animate the last added strike if requested
        if (animate && i === strikeCount - 1) {
          strikeReveal(element);
        }
      } else {
        element.classList.remove('filled');
        element.classList.add('empty');
      }
    }
  }
}

export default StrikeCounter;