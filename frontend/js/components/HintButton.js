// frontend/js/components/HintButton.js
import eventService from '../services/EventService.js';
import gameService from '../services/GameService.js';

/**
 * Combined "Get a hint" + "Give Up" escalating button.
 *
 * Clicks 1..MAX_HINTS reveal one hint each. The button progressively
 * darkens with each click. After the last hint, the button turns red
 * and flips to "Give Up" — the only way to abandon the game is to
 * exhaust your hints first.
 *
 * Hints are revealed in highest-rank-first order (#5, #4, #3, ...),
 * skipping any ranks the player has already solved. Max hints are
 * capped at MAX_HINTS or the number of unsolved ranks, whichever is
 * smaller.
 */
const MAX_HINTS = 3;

class HintButton {
  constructor() {
    this.hintsByRank = new Map();
    this.revealedRanks = new Set();
    this.hintsUsed = 0;

    this.module = document.getElementById('hints-module');
    this.button = document.getElementById('hint-button');
    this.list = document.getElementById('hint-list');

    this.setupEventListeners();
    this.updateButtonState();
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
   * Max hints allowed this game = min(MAX_HINTS, number of unsolved ranks)
   */
  hintBudget() {
    const unsolvedRanks = this.getUnsolvedRanksWithHints().length;
    return Math.min(MAX_HINTS, unsolvedRanks);
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
    this.appendHintToList(hintText);
    this.updateButtonState();
  }

  appendHintToList(text) {
    if (!this.list) return;
    const item = document.createElement('div');
    item.className = 'hint-item';
    item.textContent = text;
    this.list.prepend(item);
    requestAnimationFrame(() => item.classList.add('visible'));
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
      // State mirrors how many hints have been used (0, 1, or 2 before give-up)
      this.button.setAttribute('data-state', String(this.hintsUsed));
      this.button.textContent = 'Get a hint';
    }
  }

  async performGiveUp() {
    if (!confirm('Are you sure you want to give up? All remaining answers will be revealed.')) {
      return;
    }
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
    if (this.module) this.module.style.display = 'none';
  }
}

export default HintButton;
