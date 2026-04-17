import eventService from '../services/EventService.js';

/**
 * Host-style commentary bubble tied to 2-3 of the top-5 answers (Claude picks
 * the comedy targets at daily-tally time — not necessarily #1). Shares the
 * .host-bubble aesthetic with ClosenessFeedback so both read as the same host.
 *
 * On init we fetch the quips lazily so their text stays out of the initial
 * question payload. When a correctly-revealed rank matches one of the quip
 * targets, the bubble fires above the sticky guess form with that specific
 * line. Each quip fires at most once per game (defensive; the revealed event
 * normally only fires once per rank).
 */
class CommentaryOverlay {
  constructor() {
    this.element = document.getElementById('commentary-overlay');
    this.copy = this.element?.querySelector('.host-copy');
    this.hideTimer = null;
    this.quipsByRank = new Map();
    this.firedRanks = new Set();

    if (!this.element || !this.copy) return;

    eventService.on('game:initialized', (event) => {
      const questionId = event.detail?.question?.id;
      if (questionId) this.fetchQuips(questionId);
    });

    eventService.on('game:answer-revealed', (event) => {
      if (document.body.dataset.gameRestoring === 'true') return;
      const { rank } = event.detail || {};
      if (!rank || this.firedRanks.has(rank)) return;
      const text = this.quipsByRank.get(rank);
      if (text) {
        this.firedRanks.add(rank);
        this.show(text);
      }
    });
  }

  async fetchQuips(questionId) {
    try {
      const response = await fetch(`/guesses/commentary/${questionId}`);
      const data = await response.json();
      const quips = Array.isArray(data.quips) ? data.quips : [];
      for (const q of quips) {
        if (Number.isInteger(q?.targetRank) && typeof q?.text === 'string') {
          this.quipsByRank.set(q.targetRank, q.text);
        }
      }
    } catch (error) {
      console.error('Error fetching commentary:', error);
    }
  }

  show(text) {
    // Wait for the card to finish its reveal flourish before the bubble
    // appears (card lift + count-up finish ~1950ms after the reveal event).
    setTimeout(() => {
      this.copy.textContent = text;
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
