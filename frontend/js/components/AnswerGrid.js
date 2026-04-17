// frontend/js/components/AnswerGrid.js

import AnswerBox from './AnswerBox.js';
import eventService from '../services/EventService.js';

/**
 * Component representing the grid of answer boxes
 */
class AnswerGrid {
  /**
   * Creates a new AnswerGrid
   * @param {string} containerId - The ID of the container element
   */
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.answerBoxes = [];
    this.questionId = null;
    
    // Listen for answer events
    eventService.on('game:answer-revealed', (event) => {
      const { rank, guess, voteCount, canonicalAnswer } = event.detail;
      this.revealAnswer(rank, guess, voteCount, canonicalAnswer);
    });
    
    // Listen for already guessed events
    eventService.on('game:already-guessed', (event) => {
      const { rank } = event.detail;
      this.highlightAnswer(rank);
    });
  }

  /**
   * Initializes the grid with a specific number of answer boxes
   * @param {number} count - The number of answer boxes to create
   */
  initialize(count) {
    // Clear container
    this.container.innerHTML = '';
    this.answerBoxes = [];

    // Create at most 5 answer boxes
    const boxesToCreate = Math.min(count, 5);

    // Create answer boxes
    for (let i = 1; i <= boxesToCreate; i++) {
      const answerBox = new AnswerBox(i);
      this.answerBoxes.push(answerBox);
      this.container.appendChild(answerBox.getElement());
    }
  }
  
  /**
   * Reveals an answer with animation
   * @param {number} rank - The rank of the answer to reveal
   * @param {string} answer - The text of the answer
   * @param {number} voteCount - The vote count for this answer
   * @param {string} canonicalAnswer - Optional canonical version of the answer
   */
  revealAnswer(rank, answer, voteCount, canonicalAnswer = null) {
    // Only reveal answers with rank 1-5
    if (rank > 5) return;
    
    const answerBox = this.answerBoxes.find(box => box.rank === rank);
    if (answerBox) {
      answerBox.reveal(answer, voteCount, canonicalAnswer, true);
    }
  }
  
  /**
   * Highlights an already guessed answer
   * @param {number} rank - The rank of the answer to highlight
   */
  highlightAnswer(rank) {
    // Only highlight answers with rank 1-5
    if (rank > 5) return;
    
    const answerBox = this.answerBoxes.find(box => box.rank === rank);
    if (answerBox) {
      answerBox.highlight();
    }
  }
  
  /**
   * Reveals all remaining answers with staggered animations.
   * Used for give-up and strike-out. Runs as a single coordinated sequence
   * rather than per-card drama: one overlay pass, no z-index lifts (so
   * cards don't stack/overlap awkwardly), tighter timing.
   * @param {Array} remainingAnswers - Array of answer data to reveal
   * @returns {Promise} - Resolves when all reveals are complete
   */
  revealAllRemaining(remainingAnswers) {
    const topFive = remainingAnswers
      .filter(a => a.rank <= 5)
      .sort((a, b) => b.rank - a.rank); // reveal #5 → #1 for anticipation

    if (topFive.length === 0) return Promise.resolve();

    const overlay = document.getElementById('reveal-dim-overlay');
    if (overlay) overlay.classList.add('active-soft');

    const stagger = 450;
    const revealHold = 700;

    return new Promise(resolve => {
      topFive.forEach((answer, i) => {
        setTimeout(() => {
          const box = this.answerBoxes.find(b => b.rank === answer.rank);
          if (box) {
            box.reveal(answer.answer, answer.voteCount, null, false, { batch: true });
          }
        }, i * stagger);
      });

      // Clear overlay once the last reveal has finished its hold.
      const totalMs = (topFive.length - 1) * stagger + revealHold + 150;
      setTimeout(() => {
        if (overlay) overlay.classList.remove('active-soft', 'active');
        resolve();
      }, totalMs);
    });
  }
}

export default AnswerGrid;