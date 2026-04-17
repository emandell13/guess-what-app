import eventService from '../services/EventService.js';

/**
 * Host-style commentary bubble tied to ONE of the top-5 answers (Claude picks
 * the comedy target at daily-tally time — not necessarily #1). Shares the
 * .host-bubble aesthetic with ClosenessFeedback so both read as the same host.
 *
 * On init we fetch the quip lazily so the text stays out of the initial
 * question payload. When the matching rank is correctly revealed, the bubble
 * fires above the sticky guess form.
 */
class CommentaryOverlay {
  constructor() {
    this.element = document.getElementById('commentary-overlay');
    this.copy = this.element?.querySelector('.host-copy');
    this.hideTimer = null;
    this.quipTargetRank = null;
    this.quipText = null;

    if (!this.element || !this.copy) return;

    eventService.on('game:initialized', (event) => {
      const questionId = event.detail?.question?.id;
      if (questionId) this.fetchQuip(questionId);
    });

    eventService.on('game:answer-revealed', (event) => {
      if (document.body.dataset.gameRestoring === 'true') return;
      const { rank } = event.detail || {};
      if (rank && rank === this.quipTargetRank && this.quipText) {
        this.show();
      }
    });
  }

  async fetchQuip(questionId) {
    try {
      const response = await fetch(`/guesses/commentary/${questionId}`);
      const data = await response.json();
      this.quipTargetRank = data.quipTargetRank || null;
      this.quipText = data.quipText || null;
    } catch (error) {
      console.error('Error fetching commentary:', error);
    }
  }

  show() {
    // Wait for the card to finish its reveal flourish before the bubble
    // appears (card lift + count-up finish ~1950ms after the reveal event).
    setTimeout(() => {
      this.copy.textContent = this.quipText;
      this.element.classList.add('in');
      clearTimeout(this.hideTimer);
      this.hideTimer = setTimeout(() => this.hide(), 2500);
    }, 1950);
  }

  hide() {
    this.element.classList.remove('in');
  }
}

export default CommentaryOverlay;
