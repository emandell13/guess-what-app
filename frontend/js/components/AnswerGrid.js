import AnswerBox from './AnswerBox.js';
import { staggerAnimations } from '../utils/animationUtils.js';

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
  }
  
  /**
   * Initializes the grid with a specific number of answer boxes
   * @param {number} count - The number of answer boxes to create
   */
  initialize(count) {
    // Clear container
    this.container.innerHTML = '';
    this.answerBoxes = [];
    
    // Create answer boxes
    for (let i = 1; i <= count; i++) {
      const answerBox = new AnswerBox(i);
      this.answerBoxes.push(answerBox);
      this.container.appendChild(answerBox.getElement());
    }
  }
  
  /**
   * Reveals an answer with animation
   * @param {number} rank - The rank of the answer to reveal
   * @param {string} answer - The text of the answer
   * @param {number} points - The points for this answer
   * @param {string} canonicalAnswer - Optional canonical version of the answer
   */
  revealAnswer(rank, answer, points, canonicalAnswer = null) {
    const answerBox = this.answerBoxes.find(box => box.rank === rank);
    if (answerBox) {
      answerBox.reveal(answer, points, canonicalAnswer, true);
    }
  }
  
  /**
   * Reveals all remaining answers with staggered animations
   * @param {Array} remainingAnswers - Array of answer data to reveal
   * @returns {Promise} - Resolves when all reveals are complete
   */
  revealAllRemaining(remainingAnswers) {
    return staggerAnimations(
      remainingAnswers,
      (answer) => {
        const answerBox = this.answerBoxes.find(box => box.rank === answer.rank);
        if (answerBox) {
          answerBox.reveal(answer.answer, answer.points, null, false);
        }
      },
      1000 // 1 second between animations
    );
  }
}

export default AnswerGrid;