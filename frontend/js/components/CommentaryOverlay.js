import eventService from '../services/EventService.js';

/**
 * Host-style commentary bubble that appears after the #1 answer is revealed.
 * Text is a local placeholder for now — will be swapped for a Claude-generated
 * quip per question once the backend piece is wired up.
 */
class CommentaryOverlay {
  constructor() {
    this.element = document.getElementById('commentary-overlay');
    this.bubble = this.element?.querySelector('.commentary-bubble');
    this.dim = document.getElementById('commentary-dim');
    this.hideTimer = null;

    if (!this.element || !this.bubble) return;

    eventService.on('game:rank-one-revealed', (event) => {
      if (document.body.dataset.gameRestoring === 'true') return;
      const { answer } = event.detail || {};
      this.show(answer);
    });
  }

  show(answer) {
    // Fire right as the reveal's own dim starts fading out (1300ms in), so
    // the commentary dim picks up where it leaves off — no bright gap in
    // between. Count-up has already finished (~1000ms), so the reveal has
    // its moment first.
    setTimeout(() => {
      this.bubble.textContent = this.buildQuip(answer);
      this.element.classList.add('in');
      this.dim?.classList.add('in');
      clearTimeout(this.hideTimer);
      this.hideTimer = setTimeout(() => this.hide(), 3000);
    }, 1300);
  }

  hide() {
    this.element.classList.remove('in');
    this.dim?.classList.remove('in');
  }

  buildQuip(answer) {
    if (!answer) return 'The people have spoken.';
    return `Of course "${answer}" took it. The people have spoken.`;
  }
}

export default CommentaryOverlay;
