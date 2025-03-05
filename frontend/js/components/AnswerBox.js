import { flipReveal } from '../utils/animationUtils.js';

/**
 * Component representing a single answer box
 */
class AnswerBox {
  /**
   * Creates a new AnswerBox
   * @param {number} rank - The rank of the answer (1-5)
   */
  constructor(rank) {
    this.rank = rank;
    this.element = null;
    this.revealed = false;
    this.createDomElement();
  }
  
  /**
   * Creates the DOM element for the answer box
   */
  createDomElement() {
    this.element = document.createElement("div");
    this.element.className = "col-12 mb-2";
    this.element.id = `answer-${this.rank}`;
    this.element.innerHTML = `
      <div class="d-flex align-items-center gap-3">
        <h4 class="mb-0">#${this.rank}</h4>
        <div class="card flex-grow-1">
          <div class="card-body d-flex justify-content-between align-items-center py-3 bg-light" style="min-height: 60px">
            <span class="answer-text flex-grow-1 text-center h5 mb-0"></span>
            <span class="points badge d-none">0 pts</span>
          </div>
        </div>
      </div>
    `;
  }
  
  /**
   * Gets the DOM element for this answer box
   * @returns {HTMLElement} - The DOM element
   */
  getElement() {
    return this.element;
  }
  
  /**
   * Reveals this answer with an animation
   * @param {string} answer - The text of the answer
   * @param {number} points - The points for this answer
   * @param {string} canonicalAnswer - Optional canonical version of the answer
   * @param {boolean} isSuccess - Whether this is a successful guess or a reveal
   */
  reveal(answer, points, canonicalAnswer = null, isSuccess = true) {
    if (this.revealed) return;
    
    const cardBody = this.element.querySelector(".card-body");
    const answerText = this.element.querySelector(".answer-text");
    const pointsBadge = this.element.querySelector(".points");
    
    // Start with empty text
    answerText.textContent = "";
    
    // Add animation with callback for half-way point
    flipReveal(
      cardBody,
      // Half-way callback
      () => {
        answerText.textContent = canonicalAnswer || answer;
        answerText.classList.add('visible');
        pointsBadge.textContent = `${points} pts`;
        pointsBadge.classList.remove("d-none");
        cardBody.classList.remove("bg-light");
        
        if (isSuccess) {
          cardBody.classList.add("bg-success", "bg-opacity-25");
        } else {
          cardBody.classList.add("bg-danger", "bg-opacity-25");
        }
      },
      // Complete callback
      () => {
        this.revealed = true;
      }
    );
  }
}

export default AnswerBox;