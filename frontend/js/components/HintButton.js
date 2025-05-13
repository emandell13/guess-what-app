// frontend/js/components/HintButton.js
import eventService from '../services/EventService.js';

/**
 * Component for displaying hints for answers
 */
class HintButton {
  /**
   * Creates a new HintButton
   */
  constructor() {
    this.hints = new Map(); // Map of rank to hint text
    this.currentRank = null; // Currently displayed hint rank
    this.container = document.getElementById('hint-container');
    this.button = document.getElementById('hint-button');
    this.hintText = document.getElementById('hint-text');
    
    // Initialize UI
    this.setupEventListeners();
    this.hideHint();
  }
  
  /**
   * Sets up event listeners
   */
  setupEventListeners() {
    // Toggle hint visibility when button is clicked
    if (this.button) {
      this.button.addEventListener('click', () => {
        if (this.container.style.display === 'none') {
          this.showHint();
        } else {
          this.hideHint();
        }
      });
    }
    
    // Listen for game initialization to load hints
    eventService.on('game:initialized', async (event) => {
      if (event.detail.question && event.detail.question.id) {
        await this.loadHints(event.detail.question.id);
      }
    });
    
    // Listen for game:completed to hide hints
    eventService.on('game:completed', () => {
      this.hideHint();
      if (this.button) {
        this.button.disabled = true;
      }
    });
  }
  
  /**
   * Loads hints for a question
   * @param {number} questionId - The question ID
   */
  async loadHints(questionId) {
    try {
      const response = await fetch(`/guesses/hints/${questionId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch hints');
      }
      
      const data = await response.json();
      
      // Clear existing hints
      this.hints.clear();
      
      // Store hints by rank
      if (data.hints && data.hints.length > 0) {
        data.hints.forEach(hint => {
          if (hint.hint) {
            this.hints.set(hint.rank, hint.hint);
          }
        });
        
        console.log(`Loaded ${this.hints.size} hints`);
        
        // Enable the hint button if we have hints
        if (this.button && this.hints.size > 0) {
          this.button.disabled = false;
        }
      }
    } catch (error) {
      console.error('Error loading hints:', error);
    }
  }
  
  /**
   * Shows a hint for a specific rank
   * @param {number} rank - The rank to show a hint for (if null, shows any available hint)
   */
  showHint(rank = null) {
    // If a specific rank is requested, use that
    if (rank !== null) {
      this.currentRank = rank;
    } 
    // Otherwise pick the lowest rank that hasn't been guessed yet
    else if (!this.currentRank) {
      // Get the lowest rank with a hint
      const availableRanks = Array.from(this.hints.keys()).sort((a, b) => a - b);
      this.currentRank = availableRanks[0] || 1;
    }
    
    // Get hint for current rank
    const hint = this.hints.get(this.currentRank);
    
    // If we have a hint, show it
    if (hint && this.container && this.hintText) {
      this.hintText.textContent = hint;
      this.container.style.display = 'block';
      
      // Update button text
      if (this.button) {
        this.button.innerHTML = '<i class="fas fa-lightbulb"></i> Hide Hint';
      }
      
      // Emit event
      eventService.emit('hint:shown', {
        rank: this.currentRank,
        hint
      });
    }
  }
  
  /**
   * Hides the hint
   */
  hideHint() {
    if (this.container) {
      this.container.style.display = 'none';
      
      // Update button text
      if (this.button) {
        this.button.innerHTML = '<i class="fas fa-lightbulb"></i> Show Hint';
      }
      
      // Emit event
      eventService.emit('hint:hidden');
    }
  }
  
  /**
   * Updates the hint button UI based on availability of hints
   * @param {boolean} hasHints - Whether hints are available
   */
  updateHintButtonUI(hasHints) {
    if (this.button) {
      this.button.disabled = !hasHints;
    }
  }
}

export default HintButton;