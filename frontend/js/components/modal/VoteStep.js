import voteService from '../../services/VoteService.js';
import eventService from '../../services/EventService.js';

/**
 * Component representing the voting step of the game completion modal
 */
class VoteStep {
  /**
   * Creates a new VoteStep
   * @param {string} stepId - The ID of the step element
   */
  constructor(stepId) {
    this.stepElement = document.getElementById(stepId);
    this.questionElement = this.stepElement.querySelector('.vote-container p');
    this.formContainer = document.getElementById('modalVoteForm');
    this.nextButton = this.stepElement.querySelector('.btn-next');
    
    // Set up event listener for next button
    this.nextButton.addEventListener('click', () => {
      eventService.emit('modal:next-step', {
        currentStep: 'vote',
        nextStep: 'share'
      });
    });
    
    // Set up event listeners for vote events
    this.setupEventListeners();
  }
  
  /**
   * Sets up event listeners
   */
  setupEventListeners() {
    // Listen for vote submission events
    eventService.on('vote:submitted', (event) => {
      this.showSuccessMessage(event.detail.message || "Vote recorded successfully!");
    });
    
    eventService.on('vote:error', (event) => {
      this.showErrorMessage(event.detail.error || "Failed to submit vote");
    });
    
    eventService.on('vote:already-voted', () => {
      this.showAlreadyVotedMessage();
    });
    
    // Listen for question loaded events
    eventService.on('vote:question-loaded', (event) => {
      const { questionText } = event.detail;
      this.updateQuestionText(questionText);
    });
  }
  
  /**
   * Updates the question text display
   */
  updateQuestionText(questionText) {
    this.questionElement.innerHTML = `<strong>${questionText}</strong><br>`;
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
          <input type="text" class="form-control" placeholder="Your response" required>
          <button class="btn btn-primary" type="submit">Submit</button>
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
      await voteService.submitVote(userResponse);
      // The vote events are now handled by the event listeners
    } catch (error) {
      console.error("Error submitting vote:", error);
      this.showErrorMessage("An error occurred while submitting your vote.");
    }
  }
  
  /**
   * Shows a success message
   * @param {string} message - The message to display
   */
  showSuccessMessage(message) {
    // Create response message element
    const responseMsg = document.createElement('div');
    responseMsg.className = 'alert alert-success mt-3';
    responseMsg.textContent = message;
    
    this.clearPreviousMessages();
    this.formContainer.appendChild(responseMsg);
    
    // Hide form on success
    const modalVoteForm = document.getElementById("modal-vote-form");
    if (modalVoteForm) {
      modalVoteForm.style.display = 'none';
    }
  }
  
  /**
   * Shows an error message
   * @param {string} message - The error message to display
   */
  showErrorMessage(message) {
    // Show error message
    const errorMsg = document.createElement('div');
    errorMsg.className = 'alert alert-danger mt-3';
    errorMsg.textContent = message;
    
    this.clearPreviousMessages();
    this.formContainer.appendChild(errorMsg);
  }
  
  /**
   * Clears any previous response messages
   */
  clearPreviousMessages() {
    // Clear any previous response
    const existingResponse = this.formContainer.querySelector('.alert');
    if (existingResponse) {
      existingResponse.remove();
    }
  }
}

export default VoteStep;