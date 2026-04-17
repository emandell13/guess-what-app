import eventService from '../services/EventService.js';

/**
 * Host-style closeness bubble that appears after a wrong guess. Shares the
 * .host-bubble look with CommentaryOverlay so both read as the same host.
 *
 * Two tones:
 *   - poolCount > 0: "Ooh — N said that too. Didn't crack top 5."
 *   - poolCount === 0: "Not a soul said that. Bold."
 */
class ClosenessFeedback {
  constructor() {
    this.element = document.getElementById('closeness-feedback');
    this.copy = this.element?.querySelector('.host-copy');
    this.hideTimer = null;

    if (!this.element || !this.copy) return;

    eventService.on('game:incorrect-guess', (event) => {
      if (document.body.dataset.gameRestoring === 'true') return;
      const { guess, poolCount = 0 } = event.detail || {};
      this.show(guess, poolCount);
    });
  }

  show(guess, poolCount) {
    // Small delay so the input-shake reads as the primary feedback beat,
    // and the host bubble feels like a follow-up rather than a simultaneous
    // second source of movement.
    setTimeout(() => {
      this.copy.innerHTML = this.buildLine(guess, poolCount);
      this.element.classList.add('in');
      clearTimeout(this.hideTimer);
      this.hideTimer = setTimeout(() => this.hide(), 2500);
    }, 350);
  }

  hide() {
    this.element.classList.remove('in');
  }

  buildLine(guess, poolCount) {
    const safeGuess = this.escapeHtml(guess || '');
    if (poolCount >= 2) {
      return `Ooh — <span class="host-count">${poolCount} people</span> said "${safeGuess}" too. Didn't crack top 5.`;
    }
    if (poolCount === 1) {
      return `Ooh — <span class="host-count">1 person</span> said "${safeGuess}" too. Didn't crack top 5.`;
    }
    return `Not a soul said "${safeGuess}". Bold.`;
  }

  escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

export default ClosenessFeedback;
