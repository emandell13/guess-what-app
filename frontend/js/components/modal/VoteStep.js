import voteService from '../../services/VoteService.js';

/**
 * Component representing the voting step of the game completion modal
 */
class VoteStep {
  /**
   * Creates a new VoteStep
   * @param {string} stepId - The ID of the step element
   * @param {function} onNext - Callback for when the next button is clicked
   */
  constructor(stepId, onNext) {
    this.stepElement = document.getElementById(stepId);
    this.questionElement = this.stepElement.querySelector('.vote-container p');
    this.formContainer = document.getElementById('modalVoteForm');
    this.nextButton = this.stepElement.querySelector('.btn-next');
    
    // Set up event listener for next button
    this.nextButton.addEventListener('click', () => {
      if (onNext) onNext();
    });
  }
  
  /**
   * Shows this step and initializes the content
   */
  show() {
    this.stepElement.style.display = 'block';
    this.initializeVoteForm();
  }
  
  /**
   * Hides this step
   */
  hide() {
    this.stepElement.style.display = 'none';
  }
  
  /**
   * Initializes the vote form based on user's vote status
   */
  initializeVoteForm() {
    // Get tomorrow's question
    const questionText = voteService.getTomorrowsQuestionText();
    
    // Update the question text
    this.questionElement.innerHTML = `<strong>${questionText}</strong><br>`;
    
    // Check if user has already voted
    if (voteService.hasAlreadyVoted()) {
      this.showAlreadyVotedMessage();
    } else {
      this.createVoteForm();
    }
  }
  
  /**
   * Shows a message indicating the user has already voted
   */
  showAlreadyVotedMessage() {
    this.formContainer.innerHTML = `
      <div class="alert alert-info">
        You've already voted for tomorrow's question. Come back tomorrow to play again!
      </div>
    `;
  }
  
  /**
   * Creates the vote submission form
   */
  createVoteForm() {
    this.formContainer.innerHTML = `
      <form id="modal-vote-form" class="mt-3">
        <div class="input-group">
          <input type="text" class="form-control" placeholder="Enter your response" required>
          <button class="btn btn-primary" type="submit">Submit Vote</button>
        </div>
      </form>
    `;
    
    // Add event listener to the newly created form
    const modalVoteForm = document.getElementById("modal-vote-form");
    if (modalVoteForm) {
      modalVoteForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleVoteSubmission(e.target.elements[0].value);
      });
    }
  }
  
  /**
   * Handles the submission of a vote
   * @param {string} userResponse - The user's response
   */
  async handleVoteSubmission(userResponse) {
    try {
      const result = await voteService.submitVote(userResponse);
      
      // Create response message element
      const responseMsg = document.createElement('div');
      responseMsg.className = result.success ? 'alert alert-success mt-3' : 'alert alert-danger mt-3';
      responseMsg.textContent = result.message;
      
      // Clear any previous response
      const existingResponse = this.formContainer.querySelector('.alert');
      if (existingResponse) {
        existingResponse.remove();
      }
      
      // Add response message
      this.formContainer.appendChild(responseMsg);
      
      // Hide form on success
      if (result.success) {
        const modalVoteForm = document.getElementById("modal-vote-form");
        if (modalVoteForm) {
          modalVoteForm.style.display = 'none';
        }
      }
    } catch (error) {
      console.error("Error submitting vote:", error);
      
      // Show error message
      const errorMsg = document.createElement('div');
      errorMsg.className = 'alert alert-danger mt-3';
      errorMsg.textContent = "An error occurred while submitting your vote.";
      
      // Clear any previous response
      const existingResponse = this.formContainer.querySelector('.alert');
      if (existingResponse) {
        existingResponse.remove();
      }
      
      this.formContainer.appendChild(errorMsg);
    }
  }
}

export default VoteStep;