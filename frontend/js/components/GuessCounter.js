import eventService from '../services/EventService.js';

/**
 * Component representing the guess counter display
 */
class GuessCounter {
  /**
   * Creates a new GuessCounter
   * @param {string} containerId - The ID of the container element
   */
  constructor(containerId) {
    this.containerId = containerId;
    this.container = document.getElementById(containerId);
    
    // If the container doesn't exist yet, create it
    if (!this.container) {
      this.createCounterElement();
    }
    
    // Set a default guess count
    this.guessCount = 0;
    
    // Listen for relevant events
    this.setupEventListeners();
    
    // Initial update of the counter
    this.updateDOM();
  }
  
  /**
   * Creates the counter element if it doesn't exist
   */
  createCounterElement() {
    // Find the existing score/strikes row
    const statsRow = document.querySelector('.d-flex.justify-content-between.align-items-center.mb-4');
    
    if (statsRow) {
      // Clear existing content
      statsRow.innerHTML = '';
      
      // Create guess counter container (left side)
      this.container = document.createElement('div');
      this.container.id = this.containerId;
      this.container.className = 'text-start';
      
      // Create counter content
      this.container.innerHTML = `
        <h5 class="mb-0">
          <span class="guess-label">Guesses:</span> 
          <span class="guess-value" id="current-guesses">0</span>
        </h5>
      `;
      
      // Create give-up button container (right side)
      const giveUpContainer = document.createElement('div');
      giveUpContainer.className = 'text-end';
      giveUpContainer.id = 'give-up-container';
      
      // Create give-up button
      const giveUpButton = document.createElement('button');
      giveUpButton.id = 'give-up-btn';
      giveUpButton.className = 'btn btn-outline-dark btn-sm';
      giveUpButton.textContent = 'Give Up';
      giveUpContainer.appendChild(giveUpButton);
      
      // Add both to the stats row
      statsRow.appendChild(this.container);
      statsRow.appendChild(giveUpContainer);
    }
  }
  
  /**
   * Sets up event listeners
   */
  setupEventListeners() {
    // Listen for game initialization
    eventService.on('game:initialized', (event) => {
      const { totalGuesses } = event.detail;
      this.updateGuessCount(totalGuesses || 0);
    });
    
    // Listen for guess counter updates
    eventService.on('game:guess-counter-updated', (event) => {
      const { totalGuesses } = event.detail;
      this.updateGuessCount(totalGuesses);
    });
  }
  
  /**
   * Updates the internal guess count
   * @param {number} guessCount - The current number of guesses
   */
  updateGuessCount(guessCount) {
    this.guessCount = guessCount;
    this.updateDOM();
  }
  
  /**
   * Updates the DOM to display the current guess count
   */
  updateDOM() {
    // Find the guess count element
    const guessCountElement = document.getElementById('current-guesses');
    
    // Update it if it exists
    if (guessCountElement) {
      guessCountElement.textContent = this.guessCount;
    }
  }
}

export default GuessCounter;