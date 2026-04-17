// frontend/js/components/HintButton.js
import eventService from '../services/EventService.js';
import gameService from '../services/GameService.js';
import { saveTodayHintedRanks, getTodayHintedRanks } from '../utils/visitorUtils.js';

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
        this.restoreHintedRanks();
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
   * True when no more hints can be revealed — the next click triggers Give Up.
   */
  isGiveUpState() {
    return this.getHintCandidates().length === 0;
  }

  /**
   * Unsolved ranks with a hint defined that haven't been revealed yet,
   * ordered #5 → #1.
   */
  getHintCandidates() {
    const guessedRanks = new Set(
      (gameService.correctGuesses || []).map((g) => g.rank)
    );
    return Array.from(this.hintsByRank.keys())
      .filter((rank) => !guessedRanks.has(rank) && !this.revealedRanks.has(rank))
      .sort((a, b) => b - a);
  }

  revealNextHint() {
    const candidates = this.getHintCandidates();
    if (candidates.length === 0) return;

    const nextRank = candidates[0];
    const hintText = this.hintsByRank.get(nextRank);
    if (!hintText) return;

    this.revealedRanks.add(nextRank);
    saveTodayHintedRanks(Array.from(this.revealedRanks));

    // Let the corresponding answer box flip and show the hint in-place
    eventService.emit('hint:revealed', { rank: nextRank, hint: hintText });

    this.updateButtonState();
  }

  /**
   * Replays hint state from a prior same-day session. AnswerBox constructors
   * have already seeded their hintShown flag from localStorage (so solved
   * ranks re-render yellow via reveal()). Here we just re-emit hint:revealed
   * for unsolved hinted ranks so the hint text reappears in the box.
   */
  restoreHintedRanks() {
    const stored = getTodayHintedRanks();
    if (!Array.isArray(stored) || stored.length === 0) return;

    const solvedRanks = new Set(
      (gameService.correctGuesses || []).map((g) => g.rank)
    );

    stored.forEach((rank) => {
      this.revealedRanks.add(rank);
      if (!solvedRanks.has(rank)) {
        const hintText = this.hintsByRank.get(rank);
        if (hintText) {
          eventService.emit('hint:revealed', { rank, hint: hintText });
        }
      }
    });
  }

  updateButtonState() {
    if (!this.button) return;

    // The button is always clickable while the game is in progress —
    // either it reveals a hint, or it triggers give-up.
    this.button.disabled = false;

    if (this.isGiveUpState()) {
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
