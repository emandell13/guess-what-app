// frontend/js/components/AnswerBox.js

import { flipReveal } from '../utils/animationUtils.js';
import eventService from '../services/EventService.js';

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
    this.hintShown = false;
    this.hint = null;
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

    // Add hint lightbulb icon
    const hintButton = document.createElement('button');
    hintButton.className = 'hint-button';
    hintButton.innerHTML = '<i class="fas fa-lightbulb"></i>';
    hintButton.setAttribute('aria-label', 'Show hint');
    hintButton.style.display = 'none'; // Hidden until hints are loaded

    // Insert the hint button near the end of the card-body
    const cardBody = this.element.querySelector('.card-body');
    cardBody.appendChild(hintButton);

    // Add click event for hint button
    hintButton.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent triggering other click events
      this.toggleHint();
    });
  }

  /**
   * Sets the hint for this answer box
   * @param {string} hint - The hint text
   */
  setHint(hint) {
    if (!hint) return;

    // Format the hint to sentence case
    const formattedHint = hint.charAt(0).toUpperCase() + hint.slice(1).toLowerCase();
    this.hint = formattedHint;

    // Show the hint button if we have a hint and answer isn't revealed
    const hintButton = this.element.querySelector('.hint-button');
    if (hintButton && !this.revealed) {
      hintButton.style.display = 'inline-block';
    }
  }

  /**
   * Toggles the visibility of the hint
   */
  /**
 * Toggles the visibility of the hint
 */
  toggleHint() {
    if (!this.hint) return;

    const cardBody = this.element.querySelector(".card-body");
    const answerText = this.element.querySelector(".answer-text");

    // Use flipReveal animation
    if (this.hintShown) {
      // Hide hint with animation - keep the text until animation is complete
      const currentText = answerText.textContent;

      flipReveal(
        cardBody,
        () => {
          // Halfway callback - don't change text yet
        },
        () => {
          // Complete callback - now hide the text
          answerText.textContent = "";
          answerText.classList.remove('hint-visible');
          this.hintShown = false;
        }
      );
    } else {
      // Show hint with animation - don't show text until animation is complete
      flipReveal(
        cardBody,
        () => {
          // Halfway callback - don't change text yet
        },
        () => {
          // Complete callback - now show the hint
          answerText.textContent = this.hint;
          answerText.classList.add('hint-visible');
          this.hintShown = true;
        }
      );
    }
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
    const hintButton = this.element.querySelector(".hint-button");

    // Start with empty text
    answerText.textContent = "";

    // Add animation with callback for half-way point
    flipReveal(
      cardBody,
      // Half-way callback
      () => {
        // Remove hint-visible class if it was added
        answerText.classList.remove('hint-visible');

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

        // Hide hint button since answer is revealed
        if (hintButton) {
          hintButton.style.display = 'none';
        }
      },
      // Complete callback
      () => {
        this.revealed = true;
        this.hintShown = false;
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