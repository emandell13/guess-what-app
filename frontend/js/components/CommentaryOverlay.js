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
    // Two-stage entrance so nothing competes with the #1 reveal:
    // - At 1300ms the reveal's own dim starts fading out, so we bring
    //   OUR dim in at the same moment. Page stays continuously dark,
    //   no bright flash in between.
    // - The #1 card doesn't finish dropping back to rest until ~1950ms
    //   (1500ms + 0.45s transition), so the bubble waits for that so it
    //   doesn't pop up while the card is still moving.
    setTimeout(() => {
      this.dim?.classList.add('in');
    }, 1300);

    setTimeout(() => {
      this.bubble.textContent = this.buildQuip(answer);
      this.element.classList.add('in');
      clearTimeout(this.hideTimer);
      this.hideTimer = setTimeout(() => this.hide(), 2200);
    }, 1950);
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
