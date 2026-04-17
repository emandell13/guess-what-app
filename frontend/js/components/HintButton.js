// frontend/js/components/HintButton.js
import eventService from '../services/EventService.js';
import gameService from '../services/GameService.js';

/**
 * Component that reveals hints one at a time.
 * Hints are not labeled — the player figures out which answer each hint
 * points to. Reveal order is highest rank first (#5, #4, ... #1) since
 * the lower-ranked answers are typically the hardest to guess.
 * Skips ranks the player has already solved.
 */
class HintButton {
  constructor() {
    this.hintsByRank = new Map();      // rank -> hint text
    this.revealedRanks = new Set();    // ranks the player has used a hint for
    this.module = document.getElementById('hints-module');
    this.button = document.getElementById('hint-button');
    this.list = document.getElementById('hint-list');

    this.setupEventListeners();
    this.updateButtonState();
  }

  setupEventListeners() {
    if (this.button) {
      this.button.addEventListener('click', () => this.revealNextHint());
    }

    // Load hints when the game is initialized
    eventService.on('game:initialized', async (event) => {
      if (event.detail && event.detail.question && event.detail.question.id) {
        await this.loadHints(event.detail.question.id);

        // If the game is already over (restored completed state), hide
        if (gameService.isGameOver()) {
          this.hideModule();
        } else {
          this.updateButtonState();
        }
      }
    });

    // An answer was correctly revealed — update available hint count
    eventService.on('game:answer-revealed', () => {
      this.updateButtonState();
    });

    // Game ended — hide the module entirely
    eventService.on('game:completed', () => this.hideModule());
    eventService.on('game:struck-out', () => this.hideModule());
    eventService.on('game:gave-up', () => this.hideModule());
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

  /**
   * Reveals the next available hint — highest rank that is neither
   * already revealed as a hint nor already correctly guessed.
   */
  revealNextHint() {
    const nextRank = this.findNextAvailableRank();
    if (nextRank === null) return;

    const hintText = this.hintsByRank.get(nextRank);
    if (!hintText) return;

    this.revealedRanks.add(nextRank);
    this.appendHintToList(hintText);
    this.updateButtonState();
  }

  findNextAvailableRank() {
    const guessedRanks = new Set(
      (gameService.correctGuesses || []).map((g) => g.rank)
    );
    // Walk from the highest rank down and return the first that is
    // unrevealed-as-hint AND unguessed.
    const ranks = Array.from(this.hintsByRank.keys()).sort((a, b) => b - a);
    for (const rank of ranks) {
      if (!this.revealedRanks.has(rank) && !guessedRanks.has(rank)) {
        return rank;
      }
    }
    return null;
  }

  appendHintToList(text) {
    if (!this.list) return;
    const item = document.createElement('div');
    item.className = 'hint-item';
    item.textContent = text;
    // Newest hint on top so it appears right below the button
    this.list.prepend(item);
    // Trigger fade-in on the next frame
    requestAnimationFrame(() => item.classList.add('visible'));
  }

  updateButtonState() {
    if (!this.button) return;
    const hasMore = this.findNextAvailableRank() !== null;
    const hasRevealedAny = this.revealedRanks.size > 0;

    this.button.disabled = !hasMore;

    if (!hasMore) {
      this.button.innerHTML = '<i class="fas fa-lightbulb"></i> No more hints';
    } else if (hasRevealedAny) {
      this.button.innerHTML = '<i class="fas fa-lightbulb"></i> Get another hint';
    } else {
      this.button.innerHTML = '<i class="fas fa-lightbulb"></i> Get a hint';
    }
  }

  hideModule() {
    if (this.module) this.module.style.display = 'none';
  }
}

export default HintButton;
