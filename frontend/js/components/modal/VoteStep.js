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
    this.questionElement = this.stepElement.querySelector('.question-text');
    this.formElement = document.getElementById('modal-vote-form');
    this.responseMessageElement = document.getElementById('vote-response-message');
    this.skipLink = this.stepElement.querySelector('.skip-link');
    
    // Set up event listeners
    this.setupEventListeners();
  }
  
  /**
   * Sets up event listeners
   */
  setupEventListeners() {
    // Form submission
    if (this.formElement) {
      this.formElement.addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = this.formElement.querySelector('input');
        await this.handleVoteSubmission(input.value);
      });
    }
    
    // Skip link
    if (this.skipLink) {
      this.skipLink.addEventListener('click', (e) => {
        e.preventDefault();
        eventService.emit('modal:next-step', {
          currentStep: 'vote',
          nextStep: 'share'
        });
      });
    }
    
    // Listen for vote events
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
    if (this.questionElement) {
      this.questionElement.textContent = questionText || "What do you think most people will answer?";
    }
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
    this.updateQuestionText(questionText);
    
    // Check if user has already voted
    if (voteService.hasAlreadyVoted()) {
      this.showAlreadyVotedMessage();
    } else {
      // Reset the form and response message
      if (this.formElement) {
        this.formElement.reset();
        this.formElement.style.display = 'block';
      }
      if (this.responseMessageElement) {
        this.responseMessageElement.innerHTML = '';
      }
    }
  }
  
  /**
 * Shows a message indicating the user has already voted
 */
showAlreadyVotedMessage() {
  // Hide the form but leave the question visible
  const questionContainer = this.stepElement.querySelector('.question-container');
  const formContainer = this.formElement?.parentElement;
  
  if (questionContainer) {
    // Keep the container visible but hide only the form
    questionContainer.style.display = 'block';
  }
  
  if (formContainer) {
    formContainer.style.display = 'none';
  }
  
  // Show the thanks container
  const thanksContainer = document.getElementById('thanks-container');
  if (thanksContainer) {
    thanksContainer.style.display = 'block';
  }
  
  // Hide skip link and show Next button
  if (this.skipLink) {
    this.skipLink.style.display = 'none';
  }
  
  const nextButton = this.stepElement.querySelector('.btn-next');
  if (nextButton) {
    nextButton.style.display = 'inline-block';
    
    // Add event listener if not already added
    if (!nextButton.hasListener) {
      nextButton.addEventListener('click', () => {
        eventService.emit('modal:next-step', {
          currentStep: 'vote',
          nextStep: 'share'
        });
      });
      nextButton.hasListener = true;
    }
  }
}

  
  /**
   * Handles the submission of a vote
   * @param {string} userResponse - The user's response
   */
  async handleVoteSubmission(userResponse) {
    try {
      const input = this.formElement.querySelector('input');
      const submitButton = this.formElement.querySelector('button[type="submit"]');
      
      // Disable input and button during submission
      if (input) input.disabled = true;
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Submitting...';
      }
      
      await voteService.submitVote(userResponse);
      
      // Re-enable input and button (in case of error)
      if (input) input.disabled = false;
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.innerHTML = 'Submit';
      }
    } catch (error) {
      console.error("Error submitting vote:", error);
      this.showErrorMessage("An error occurred while submitting your vote.");
      
      // Re-enable input and button
      const input = this.formElement.querySelector('input');
      const submitButton = this.formElement.querySelector('button[type="submit"]');
      if (input) input.disabled = false;
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.innerHTML = 'Submit';
      }
    }
  }
  
  /**
 * Shows a success message with the "THANKS!" design
 * @param {string} message - The message to display
 */
/**
 * Shows a success message with the "THANKS!" design
 * @param {string} message - The message to display
 */
showSuccessMessage(message) {
  // Hide the form but leave the question visible
  const questionContainer = this.stepElement.querySelector('.question-container');
  const formContainer = this.formElement?.parentElement;
  
  if (questionContainer) {
    // Keep the container visible but hide only the form
    questionContainer.style.display = 'block';
  }
  
  if (formContainer) {
    formContainer.style.display = 'none';
  }
  
  // Show the thanks container
  const thanksContainer = document.getElementById('thanks-container');
  if (thanksContainer) {
    thanksContainer.style.display = 'block';
  }
  
  // Hide skip link and show Next button
  if (this.skipLink) {
    this.skipLink.style.display = 'none';
  }
  
  const nextButton = this.stepElement.querySelector('.btn-next');
  if (nextButton) {
    nextButton.style.display = 'inline-block';
    
    // Add event listener if not already added
    if (!nextButton.hasListener) {
      nextButton.addEventListener('click', () => {
        eventService.emit('modal:next-step', {
          currentStep: 'vote',
          nextStep: 'share'
        });
      });
      nextButton.hasListener = true;
    }
  }
}
  
  /**
   * Shows an error message
   * @param {string} message - The error message to display
   */
  showErrorMessage(message) {
    if (this.responseMessageElement) {
      this.responseMessageElement.innerHTML = `
        <div class="alert alert-danger">
          <i class="fas fa-exclamation-circle me-2"></i>
          ${message}
        </div>
      `;
    }
  }
}

export default VoteStep;