import eventService from '../services/EventService.js';

/**
 * Host-style commentary bubble that appears after the #1 answer is revealed.
 * Shares the .host-bubble aesthetic with ClosenessFeedback and floats just
 * above the sticky guess form so it feels like a running host beat rather
 * than a centered drumroll.
 */
class CommentaryOverlay {
  constructor() {
    this.element = document.getElementById('commentary-overlay');
    this.copy = this.element?.querySelector('.host-copy');
    this.hideTimer = null;

    if (!this.element || !this.copy) return;

    eventService.on('game:rank-one-revealed', (event) => {
      if (document.body.dataset.gameRestoring === 'true') return;
      const { answer } = event.detail || {};
      this.show(answer);
    });
  }

  show(answer) {
    // Wait for the #1 card to finish its reveal flourish before the bubble
    // appears (card lift + count-up finish ~1950ms after the reveal event).
    setTimeout(() => {
      this.copy.textContent = this.buildQuip(answer);
      this.element.classList.add('in');
      clearTimeout(this.hideTimer);
      this.hideTimer = setTimeout(() => this.hide(), 2500);
    }, 1950);
  }

  hide() {
    this.element.classList.remove('in');
  }

  buildQuip(answer) {
    if (!answer) return 'The people have spoken.';
    return `Of course "${answer}" took it. The people have spoken.`;
  }
}

export default CommentaryOverlay;
