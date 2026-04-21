// frontend/js/components/AnswerBox.js

import eventService from '../services/EventService.js';
import { getTodayHintedRanks } from '../utils/visitorUtils.js';

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
    // Seed from localStorage so a resumed game still paints yellow on
    // ranks that had a hint used before a reload. HintButton also emits
    // events for live hint use during the session.
    const storedHintedRanks = getTodayHintedRanks();
    this.hintShown = Array.isArray(storedHintedRanks) && storedHintedRanks.includes(rank);
    this.createDomElement();

    // Listen for hint reveals targeting this rank and flip the hint in-place
    eventService.on('hint:revealed', (event) => {
      if (!event.detail) return;
      if (event.detail.rank === this.rank) {
        this.showHint(event.detail.hint);
      }
    });
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
   * @param {object} opts - { batch: true } skips the per-card overlay/lift so
   *   a caller (e.g. batch reveal on give-up) can manage staging itself.
   */
  reveal(answer, voteCount, canonicalAnswer = null, isSuccess = true, opts = {}) {
    if (this.revealed) return;

    const { batch = false } = opts;

    const card = this.element.querySelector(".card");
    const cardBody = this.element.querySelector(".card-body");
    const answerText = this.element.querySelector(".answer-text");
    const votesBadge = this.element.querySelector(".points");

    // Dim the page during reveal: soft for supporting ranks, full for #1.
    // Batch reveals skip this — the caller manages a single overlay pass.
    const isBigReveal = this.rank === 1;
    const overlay = document.getElementById("reveal-dim-overlay");
    if (overlay && !batch) {
      overlay.classList.add(isBigReveal ? "active" : "active-soft");
    }

    // Lift the card (skipped in batch so cards don't fight each other's z)
    if (!batch) card.classList.add("revealing");

    // Swap card style to the correct (or incorrect-fill) color.
    // Yellow when the answer was hinted then solved — partial credit.
    cardBody.classList.remove("bg-light", "hinted");
    if (isSuccess) {
      if (this.hintShown) {
        cardBody.classList.add("solved-with-hint");
      } else {
        cardBody.classList.add("bg-success", "bg-opacity-25");
      }
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
      this.countUpVotes(votesBadge, voteCount, batch ? 500 : 750);
    }, batch ? 120 : 250);

    // Hold the moment, then ease back to rest.
    // Fade the overlay first so it fully clears before the card loses
    // its z-index lift, otherwise the card briefly falls behind the
    // dimming layer and looks like it "drops".
    const holdMs = batch ? 700 : 1300;
    setTimeout(() => {
      this.revealed = true;
      if (overlay && !batch) overlay.classList.remove("active", "active-soft");
      if (!batch) {
        setTimeout(() => {
          card.classList.remove("revealing");
        }, 200);
      }
    }, holdMs);
  }

  /**
   * Shows a hint inside this answer box. Plays a flip animation on first
   * reveal; on a restored session (hintShown already seeded true), renders
   * the static hint state without the flip.
   */
  showHint(hintText) {
    if (this.revealed) return;

    const cardBody = this.element.querySelector(".card-body");
    const answerText = this.element.querySelector(".answer-text");
    if (!cardBody || !answerText) return;

    const isRestore = this.hintShown === true;

    cardBody.classList.add("hinted");

    const formatted = hintText
      ? hintText.charAt(0).toUpperCase() + hintText.slice(1)
      : '';

    if (isRestore) {
      answerText.textContent = formatted;
      answerText.classList.add('visible');
    } else {
      cardBody.classList.add("hint-flip");
      setTimeout(() => {
        answerText.textContent = formatted;
        answerText.classList.add('visible');
      }, 350);
      setTimeout(() => {
        cardBody.classList.remove("hint-flip");
      }, 700);
    }

    this.hintShown = true;
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
   * Highlights this answer temporarily. Uses a dedicated class (not Bootstrap's
   * bg-warning) because the revealed card already carries bg-success with
   * !important — the two Bootstrap classes have equal specificity and bg-success
   * wins by source order, so the flash never shows. A custom class placed later
   * in styles.css overrides cleanly.
   */
  highlight() {
    if (!this.revealed) return;

    const cardBody = this.element.querySelector(".card-body");
    // Restart the CSS animation on rapid repeats: remove → reflow → add.
    cardBody.classList.remove("already-guessed-flash");
    void cardBody.offsetWidth;
    cardBody.classList.add("already-guessed-flash");

    clearTimeout(this._highlightTimer);
    this._highlightTimer = setTimeout(() => {
      cardBody.classList.remove("already-guessed-flash");
    }, 900);
  }
}

export default AnswerBox;