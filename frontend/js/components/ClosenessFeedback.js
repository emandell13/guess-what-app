import eventService from '../services/EventService.js';

/**
 * Host-style closeness bubble that appears after a wrong guess. Shares the
 * .host-bubble look with CommentaryOverlay so both read as the same host.
 *
 * The line comes from the backend — Claude generates a bespoke reaction per
 * guess, modulating tone on poolCount and guess content (profanity redirect,
 * solidarity when others said the same thing, playful ribbing when nobody
 * did). If the backend call errored and commentaryLine is null, falls back
 * to a client-side template so the bubble always has copy.
 */
class ClosenessFeedback {
  constructor() {
    this.element = document.getElementById('closeness-feedback');
    this.copy = this.element?.querySelector('.host-copy');
    this.hideTimer = null;

    if (!this.element || !this.copy) return;

    eventService.on('game:incorrect-guess', (event) => {
      if (document.body.dataset.gameRestoring === 'true') return;
      const { guess, poolCount = 0, commentaryLine = null } = event.detail || {};
      this.show(guess, poolCount, commentaryLine);
    });
  }

  show(guess, poolCount, commentaryLine) {
    // Small delay so the input-shake reads as the primary feedback beat,
    // and the host bubble feels like a follow-up rather than a simultaneous
    // second source of movement.
    setTimeout(() => {
      const line = commentaryLine && commentaryLine.trim()
        ? commentaryLine.trim()
        : this.buildFallback(guess, poolCount);
      this.copy.textContent = line;
      this.element.classList.add('in');
      clearTimeout(this.hideTimer);
      this.hideTimer = setTimeout(() => this.hide(), 3500);
    }, 350);
  }

  hide() {
    this.element.classList.remove('in');
  }

  buildFallback(guess, poolCount) {
    const safe = String(guess || '').trim();
    if (poolCount >= 2) return `Ooh — ${poolCount} people said "${safe}" too. Didn't crack top 5.`;
    if (poolCount === 1) return `Ooh — 1 person said "${safe}" too. Didn't crack top 5.`;
    return `Not a soul said "${safe}". Bold.`;
  }
}

export default ClosenessFeedback;
