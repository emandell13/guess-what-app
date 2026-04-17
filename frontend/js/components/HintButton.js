// frontend/js/components/HintButton.js
import eventService from '../services/EventService.js';
import gameService from '../services/GameService.js';

/**
 * Combined "Get a hint" + "Give Up" escalating button.
 *
 * One hint is available per unsolved answer. After the player has
 * used hints on every remaining unsolved rank, the button turns red
 * and flips to "Give Up" — the only way to abandon the game is to
 * exhaust every hint first.
 *
 * Hints are revealed in highest-rank-first order (#5, #4, #3, ...),
 * skipping any ranks the player has already solved on their own.
 */

class HintButton {
  constructor() {
    this.hintsByRank = new Map();
    this.revealedRanks = new Set();
    this.hintsUsed = 0;

    this.button = document.getElementById('hint-button');

    this.setupEventListeners();
  }

  setupEventListeners() {
    if (this.button) {
      this.button.addEventListener('click', () => this.handleClick());
    }

    eventService.on('game:initialized', async (event) => {
      if (event.detail && event.detail.question && event.detail.question.id) {
        await this.loadHints(event.detail.question.id);
        if (gameService.isGameOver()) {
          this.hide();
        } else {
          this.updateButtonState();
        }
      }
    });

    eventService.on('game:answer-revealed', () => this.updateButtonState());
    eventService.on('game:completed', () => this.hide());
    eventService.on('game:struck-out', () => this.hide());
    eventService.on('game:gave-up', () => this.hide());
  }

  async loadHints(questionId) {
    try {
      const response = await fetch(`/guesses/hints/${questionId}`);
      if (!response.ok) throw new Error('Failed to fetch hints');
      const data = await response.json();
      this.hintsByRank.clear();
      if (data.hints && Array.isArray(data.hints)) {
        data.hints.forEach((h) => {
          if (h.hint) this.hintsByRank.set(h.rank, h.hint);
        });
      }
    } catch (err) {
      console.error('Error loading hints:', err);
    }
  }

  handleClick() {
    if (this.isGiveUpState()) {
      this.performGiveUp();
    } else {
      this.revealNextHint();
    }
  }

  /**
   * Hint budget = one per unsolved rank with a hint defined.
   */
  hintBudget() {
    return this.getUnsolvedRanksWithHints().length;
  }

  /**
   * True when the player has used up all their hints and the next click
   * should trigger Give Up.
   */
  isGiveUpState() {
    return this.hintsUsed >= this.hintBudget();
  }

  getUnsolvedRanksWithHints() {
    const guessedRanks = new Set(
      (gameService.correctGuesses || []).map((g) => g.rank)
    );
    // #5 down to #1, only ranks with a hint defined and not already solved
    return Array.from(this.hintsByRank.keys())
      .filter((rank) => !guessedRanks.has(rank))
      .sort((a, b) => b - a);
  }

  revealNextHint() {
    const candidates = this.getUnsolvedRanksWithHints()
      .filter((rank) => !this.revealedRanks.has(rank));
    if (candidates.length === 0) return;

    const nextRank = candidates[0];
    const hintText = this.hintsByRank.get(nextRank);
    if (!hintText) return;

    this.revealedRanks.add(nextRank);
    this.hintsUsed += 1;

    // Let the corresponding answer box flip and show the hint in-place
    eventService.emit('hint:revealed', { rank: nextRank, hint: hintText });

    this.updateButtonState();
  }

  updateButtonState() {
    if (!this.button) return;

    // Budget can shrink as the player solves answers on their own, so
    // recompute each time. hintsUsed >= budget means give-up mode.
    const inGiveUpMode = this.isGiveUpState();
    const budget = this.hintBudget();

    // The button is always clickable while the game is in progress —
    // either it reveals a hint, or it triggers give-up.
    this.button.disabled = false;

    if (inGiveUpMode) {
      this.button.setAttribute('data-state', '3');
      this.button.textContent = 'Give Up';
    } else {
      this.button.setAttribute('data-state', '0');
      this.button.textContent = 'Get a hint';
    }
  }

  async performGiveUp() {
    const modalEl = document.getElementById('giveUpModal');
    if (!modalEl || typeof bootstrap === 'undefined') {
      // Fallback: run it without the custom modal if Bootstrap isn't ready.
      await this.runGiveUp();
      return;
    }

    const bsModal = bootstrap.Modal.getOrCreateInstance(modalEl);
    const confirmBtn = document.getElementById('give-up-confirm');
    if (!confirmBtn) {
      bsModal.hide();
      await this.runGiveUp();
      return;
    }

    const onConfirm = async () => {
      confirmBtn.removeEventListener('click', onConfirm);
      bsModal.hide();
      await this.runGiveUp();
    };
    confirmBtn.addEventListener('click', onConfirm, { once: true });

    bsModal.show();
  }

  async runGiveUp() {
    try {
      const result = await gameService.giveUp();
      if (!result || !result.success) {
        console.error('Give up failed:', result && result.error);
      }
    } catch (err) {
      console.error('Error giving up:', err);
    }
  }

  hide() {
    if (this.button) this.button.style.display = 'none';
  }
}

export default HintButton;
