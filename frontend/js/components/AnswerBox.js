// AnswerBox.js

import { flipReveal } from '../utils/animationUtils.js';

/**
 * Component representing a single answer box
 */
class AnswerBox {
  /**
   * Creates a new AnswerBox
   * @param {number} rank - The rank of the answer (1-5)
   */
  constructor(rank) {
    this.rank = rank;
    this.element = null;
    this.revealed = false;
    this.createDomElement();
  }
  
  /**
   * Creates the DOM element for the answer box
   */
  createDomElement() {
    // Get the template
    const template = document.getElementById('answer-box-template');
    
    // Clone the template content
    const element = template.content.cloneNode(true);
    
    // Get the root element from the template
    this.element = element.querySelector('.answer-box');
    
    // Set the ID and rank
    this.element.id = `answer-${this.rank}`;
    this.element.querySelector('.answer-rank').textContent = this.rank;
  }
  
  /**
   * Gets the DOM element for this answer box
   * @returns {HTMLElement} - The DOM element
   */
  getElement() {
    return this.element;
  }
  
  /**
   * Reveals this answer with an animation
   * @param {string} answer - The text of the answer
   * @param {number} voteCount - The votes for this answer
   * @param {string} canonicalAnswer - Optional canonical version of the answer
   * @param {boolean} isSuccess - Whether this is a successful guess or a reveal
   */
  reveal(answer, voteCount, canonicalAnswer = null, isSuccess = true) {
    if (this.revealed) return;
    
    const cardBody = this.element.querySelector(".card-body");
    const answerText = this.element.querySelector(".answer-text");
    const votesBadge = this.element.querySelector(".points");
    
    // Start with empty text
    answerText.textContent = "";
    
    // Add animation with callback for half-way point
    flipReveal(
      cardBody,
      // Half-way callback
      () => {
        answerText.textContent = canonicalAnswer || answer;
        answerText.classList.add('visible');
        
        // Update badge to show votes instead of points
        votesBadge.textContent = `${voteCount} votes`;
        votesBadge.classList.remove("d-none");
        
        cardBody.classList.remove("bg-light");
        
        if (isSuccess) {
          cardBody.classList.add("bg-success", "bg-opacity-25");
        } else {
          cardBody.classList.add("bg-danger", "bg-opacity-25");
        }
      },
      // Complete callback
      () => {
        this.revealed = true;
      }
    );
  }
  
  /**
   * Highlights this answer temporarily
   * This is used for already guessed answers
   */
  highlight() {
    if (!this.revealed) return;
    
    const cardBody = this.element.querySelector(".card-body");
    
    // Store original classes to restore later
    const originalClasses = [...cardBody.classList];
    
    // Add highlight class
    cardBody.classList.add("bg-warning", "bg-opacity-75");
    
    // Remove highlight after a delay
    setTimeout(() => {
      // Remove highlight classes
      cardBody.classList.remove("bg-warning", "bg-opacity-75");
    }, 1000);
  }
}

export default AnswerBox;