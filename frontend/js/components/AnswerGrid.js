// frontend/js/components/AnswerGrid.js

import AnswerBox from './AnswerBox.js';
import { staggerAnimations } from '../utils/animationUtils.js';
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
    
    // Listen for game initialization to load hints
    eventService.on('game:initialized', async (event) => {
      if (event.detail.question && event.detail.question.id) {
        this.questionId = event.detail.question.id;
        await this.loadHints(this.questionId);
      }
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
    
    // If we already have the question ID, load hints
    if (this.questionId) {
      this.loadHints(this.questionId);
    }
  }
  
  /**
   * Loads hints for answer boxes
   * @param {number} questionId - The question ID
   */
  async loadHints(questionId) {
    try {
      const response = await fetch(`/guesses/hints/${questionId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch hints');
      }
      
      const data = await response.json();
      
      // Set hints on answer boxes
      if (data.hints && data.hints.length > 0) {
        data.hints.forEach(hint => {
          if (hint.hint && hint.rank >= 1 && hint.rank <= this.answerBoxes.length) {
            const answerBox = this.answerBoxes.find(box => box.rank === hint.rank);
            if (answerBox) {
              answerBox.setHint(hint.hint);
              console.log(`Set hint for rank ${hint.rank}: ${hint.hint}`);
            }
          }
        });
      }
    } catch (error) {
      console.error('Error loading hints:', error);
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
   * Reveals all remaining answers with staggered animations
   * @param {Array} remainingAnswers - Array of answer data to reveal
   * @returns {Promise} - Resolves when all reveals are complete
   */
  revealAllRemaining(remainingAnswers) {
    // Filter out answers with rank > 5
    const topFiveAnswers = remainingAnswers.filter(answer => answer.rank <= 5);
    
    return staggerAnimations(
      topFiveAnswers,
      (answer) => {
        const answerBox = this.answerBoxes.find(box => box.rank === answer.rank);
        if (answerBox) {
          answerBox.reveal(answer.answer, answer.voteCount, null, false);
        }
      },
      800
    );
  }
}

export default AnswerGrid;