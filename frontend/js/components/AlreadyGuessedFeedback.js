import eventService from '../services/EventService.js';
import guessService from '../services/GuessService.js';

/**
 * Host-style bubble that appears when a correct guess maps to an answer the
 * player already solved. Mirrors ClosenessFeedback: same .host-bubble look so
 * the voice reads as the same host. The line comes from Claude per duplicate
 * (backend /guesses/duplicate-commentary) so the host can acknowledge fuzzy
 * matches like "cell phone" → "check phone". Falls back to a client-side
 * template if the backend call fails.
 */
class AlreadyGuessedFeedback {
  constructor() {
    this.element = document.getElementById('already-guessed-feedback');
    this.copy = this.element?.querySelector('.host-copy');
    this.hideTimer = null;
    this.latestRequestId = 0;

    if (!this.element || !this.copy) return;

    eventService.on('game:already-guessed', (event) => {
      if (document.body.dataset.gameRestoring === 'true') return;
      const { userGuess = '', canonicalAnswer = '', rank = null } = event.detail || {};
      this.handle(userGuess, canonicalAnswer, rank);
    });
  }

  async handle(userGuess, canonicalAnswer, rank) {
    const requestId = ++this.latestRequestId;

    // Flash the matching card immediately — it's the primary "we see you"
    // beat. The host bubble follows after a short delay so the flash leads.
    if (rank != null) {
      eventService.emit('game:already-guessed-reveal', { rank });
    }

    // Race the Claude call against a minimum delay so the bubble never
    // appears instantly — the flash always gets a visible head start.
    const [line] = await Promise.all([
      guessService.fetchDuplicateCommentary(userGuess, canonicalAnswer),
      new Promise(resolve => setTimeout(resolve, 350))
    ]);
    if (requestId !== this.latestRequestId) return;
    const finalLine = (line && line.trim()) || this.buildFallback(userGuess, canonicalAnswer);
    this.show(finalLine);
  }

  show(line) {
    this.copy.textContent = line;
    this.element.classList.add('in');
    clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => this.hide(), 3300);
  }

  hide() {
    this.element.classList.remove('in');
  }

  buildFallback(userGuess, canonicalAnswer) {
    const u = String(userGuess || '').trim();
    const c = String(canonicalAnswer || '').trim();
    if (!c) return 'Already on the board — try another.';
    if (!u || u.toLowerCase() === c.toLowerCase()) {
      return `You already got "${c}" — keep going.`;
    }
    return `"${u}" is the same as "${c}" in our book — already on the board.`;
  }
}

export default AlreadyGuessedFeedback;
