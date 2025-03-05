import gameService from '../../services/GameService.js';
import guessService from '../../services/GuessService.js';

/**
 * Component representing the share step of the game completion modal
 */
class ShareStep {
  /**
   * Creates a new ShareStep
   * @param {string} stepId - The ID of the step element
   */
  constructor(stepId) {
    this.stepElement = document.getElementById(stepId);
    this.scoreElement = this.stepElement.querySelector('#modalFinalScoreShare');
    this.strikesElement = this.stepElement.querySelector('#modalStrikes');
    this.answersSummary = this.stepElement.querySelector('.answers-summary');
    
    // Set up share buttons event listeners
    this.setupShareButtons();
  }
  
  /**
   * Shows this step and updates its content
   */
  show() {
    this.stepElement.style.display = 'block';
    this.updateContent();
  }
  
  /**
   * Hides this step
   */
  hide() {
    this.stepElement.style.display = 'none';
  }
  
  /**
   * Updates all content in the share step
   */
  async updateContent() {
    // Update score
    this.scoreElement.textContent = gameService.currentScore;
    
    // Update strikes display
    this.updateStrikesDisplay();
    
    // Update answers summary
    await this.updateAnswersSummary();
  }
  
  /**
   * Updates the strikes display
   */
  updateStrikesDisplay() {
    this.strikesElement.innerHTML = Array(3)
      .fill()
      .map((_, i) => `<i class="fa${i < gameService.strikes ? 's' : 'r'} fa-circle me-2 ${i < gameService.strikes ? 'text-danger' : 'text-muted'}"></i>`)
      .join('');
  }
  
  /**
   * Updates the answers summary section
   */
  async updateAnswersSummary() {
    try {
      const data = await guessService.getAllAnswers();
      
      // Clear existing answers
      this.answersSummary.innerHTML = '';
      
      if (!data.answers || data.error) {
        this.answersSummary.innerHTML = '<div class="alert alert-danger">Failed to load answers</div>';
        return;
      }

      // Add each answer card
      data.answers.forEach(answer => {
        const wasGuessed = gameService.correctGuesses.some(guess => 
          guess.rank === answer.rank
        );

        const card = document.createElement('div');
        card.className = `answer-card ${wasGuessed ? 'correct' : 'revealed'}`;
        card.innerHTML = `
          <div class="answer-content">
            <strong>#${answer.rank}</strong> ${answer.answer}
          </div>
          <div class="answer-points">
            ${answer.points} pts
          </div>
        `;
        this.answersSummary.appendChild(card);
      });
    } catch (error) {
      console.error('Error updating answers summary:', error);
      this.answersSummary.innerHTML = '<div class="alert alert-danger">Failed to load answers</div>';
    }
  }
  
  /**
   * Sets up event listeners for share buttons
   */
  setupShareButtons() {
    const twitterBtn = this.stepElement.querySelector('[data-platform="twitter"]');
    const copyLinkBtn = this.stepElement.querySelector('[data-action="copy-link"]');
    
    if (twitterBtn) {
      twitterBtn.addEventListener('click', () => this.shareOnTwitter());
    }
    
    if (copyLinkBtn) {
      copyLinkBtn.addEventListener('click', () => this.copyShareLink());
    }
  }
  
  /**
   * Shares the result on Twitter
   */
  shareOnTwitter() {
    const score = gameService.currentScore;
    const maxScore = gameService.maxPoints;
    const text = `I scored ${score} out of ${maxScore} points in Guess What! Can you beat my score?`;
    const url = window.location.href;
    
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
  }
  
  /**
   * Copies the share link to clipboard
   */
  copyShareLink() {
    const url = window.location.href;
    
    // Create a temporary input element
    const tempInput = document.createElement('input');
    tempInput.value = url;
    document.body.appendChild(tempInput);
    
    // Select and copy the link
    tempInput.select();
    document.execCommand('copy');
    
    // Remove the temporary element
    document.body.removeChild(tempInput);
    
    // Show feedback
    alert('Link copied to clipboard!');
  }
}

export default ShareStep;