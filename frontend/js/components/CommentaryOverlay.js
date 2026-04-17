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
    // Wait until the #1 reveal is fully settled — card has fallen back,
    // count-up is long done, reveal dim has cleared — before taking over.
    // Firing mid-animation makes the reveal feel cut off.
    setTimeout(() => {
      this.bubble.textContent = this.buildQuip(answer);
      this.element.classList.add('in');
      this.dim?.classList.add('in');
      clearTimeout(this.hideTimer);
      this.hideTimer = setTimeout(() => this.hide(), 4500);
    }, 1800);
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
