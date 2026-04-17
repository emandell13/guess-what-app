// frontend/js/components/AnswerBox.js

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

    const card = this.element.querySelector(".card");
    const cardBody = this.element.querySelector(".card-body");
    const answerText = this.element.querySelector(".answer-text");
    const votesBadge = this.element.querySelector(".points");

    // Dim the page during reveal: soft for supporting ranks, full for #1
    const isBigReveal = this.rank === 1;
    const overlay = document.getElementById("reveal-dim-overlay");
    if (overlay) {
      overlay.classList.add(isBigReveal ? "active" : "active-soft");
    }

    // Lift the card
    card.classList.add("revealing");

    // Swap card style to the correct (or incorrect-fill) color
    cardBody.classList.remove("bg-light");
    if (isSuccess) {
      cardBody.classList.add("bg-success", "bg-opacity-25");
    } else {
      cardBody.classList.add("bg-danger", "bg-opacity-25");
    }

    // Reveal the text (fades in via existing .answer-text.visible CSS)
    answerText.textContent = canonicalAnswer || answer;
    answerText.classList.add('visible');

    // Show vote badge at 0 and count up
    votesBadge.textContent = `0 votes`;
    votesBadge.classList.remove("d-none");
    // Small delay so the lift + dim settle before the numbers start rolling
    setTimeout(() => {
      this.countUpVotes(votesBadge, voteCount, 750);
    }, 250);

    // Hold the moment, then ease back to rest.
    // Fade the overlay first so it fully clears before the card loses
    // its z-index lift, otherwise the card briefly falls behind the
    // dimming layer and looks like it "drops".
    setTimeout(() => {
      this.revealed = true;
      if (overlay) overlay.classList.remove("active", "active-soft");
      setTimeout(() => {
        card.classList.remove("revealing");
      }, 200);
    }, 1300);
  }

  /**
   * Animates the vote count up from 0 to target with ease-out
   */
  countUpVotes(el, target, duration) {
    const start = performance.now();
    const tick = (now) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = Math.round(target * eased);
      el.textContent = `${current} votes`;
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
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