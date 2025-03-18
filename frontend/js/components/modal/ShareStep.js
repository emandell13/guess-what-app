// frontend/js/components/modal/ShareStep.js

import eventService from '../../services/EventService.js';

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
    
    // Game state cache
    this.gameData = {
      score: 0,
      strikes: 0,
      correctGuesses: [],
      allAnswers: null
    };

    // Set up event listeners
    this.setupEventListeners();
    
    // Set up share buttons event listeners
    this.setupShareButtons();
  }
  
  /**
   * Sets up event listeners for game events
   */
  setupEventListeners() {
    // Listen for score changes
    eventService.on('game:score-change', (event) => {
      const { currentScore } = event.detail;
      this.gameData.score = currentScore;
    });
    
    // Listen for strike added events
    eventService.on('game:strike-added', (event) => {
      const { strikes } = event.detail;
      this.gameData.strikes = strikes;
    });
    
    // Listen for answers revealed
    eventService.on('game:answer-revealed', (event) => {
      const { guess, rank, points, canonicalAnswer } = event.detail;
      
      // Store the revealed answer
      const guessInfo = {
        guess: canonicalAnswer || guess,
        rank,
        points
      };
      
      // Check if we already have this rank
      const existingIndex = this.gameData.correctGuesses.findIndex(g => g.rank === rank);
      if (existingIndex >= 0) {
        this.gameData.correctGuesses[existingIndex] = guessInfo;
      } else {
        this.gameData.correctGuesses.push(guessInfo);
      }
    });
    
    // Listen for game completed event
    eventService.on('game:completed', (event) => {
      const { currentScore, strikes, correctGuesses } = event.detail;
      this.gameData.score = currentScore;
      this.gameData.strikes = strikes;
      this.gameData.correctGuesses = correctGuesses;
      
      // Fetch all answers when game completes
      this.fetchAllAnswers();
    });
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
    this.scoreElement.textContent = this.gameData.score;

    // Update strikes display
    this.updateStrikesDisplay();

    // Update answers summary
    this.updateAnswersSummary();
  }
  
  /**
   * Fetches all answers for the current question
   */
  async fetchAllAnswers() {
    try {
      const response = await fetch("/guesses/question?includeAnswers=true");
      const data = await response.json();
      
      if (!data.error) {
        this.gameData.allAnswers = data.answers || [];
        
        // Emit event that answers were loaded
        eventService.emit('share:answers-loaded', {
          answers: this.gameData.allAnswers
        });
      }
    } catch (error) {
      console.error("Error fetching answers:", error);
      eventService.emit('share:error', {
        message: "Failed to fetch answers",
        error
      });
    }
  }

  /**
   * Updates the strikes display
   */
  updateStrikesDisplay() {
    this.strikesElement.innerHTML = Array(3)
      .fill()
      .map((_, i) => `<i class="fa${i < this.gameData.strikes ? 's' : 'r'} fa-circle me-2 ${i < this.gameData.strikes ? 'text-danger' : 'text-muted'}"></i>`)
      .join('');
  }

  /**
   * Updates the answers summary section
   */
  updateAnswersSummary() {
    // Clear existing answers
    this.answersSummary.innerHTML = '';
    
    // If we don't have answers yet, show loading
    if (!this.gameData.allAnswers) {
      this.answersSummary.innerHTML = '<div class="text-center"><span class="spinner-border spinner-border-sm"></span> Loading answers...</div>';
      return;
    }

    if (this.gameData.allAnswers.length === 0) {
      this.answersSummary.innerHTML = '<div class="alert alert-danger">Failed to load answers</div>';
      return;
    }

    // Add each answer card
    this.gameData.allAnswers.forEach(answer => {
      const wasGuessed = this.gameData.correctGuesses.some(guess =>
        guess.rank === answer.rank
      );

      const card = document.createElement('div');
      card.className = `answer-card ${wasGuessed ? 'correct' : 'revealed'}`;
      card.innerHTML = `
         <div class="answer-rank">${answer.rank}</div>
      <div class="answer-content">
        <span class="answer-text">${answer.answer}</span>
      </div>
      <div class="answer-points">
        <span class="points-badge">${answer.points} pts</span>
      </div>
      `;
      this.answersSummary.appendChild(card);
    });
    
    // Emit event that answers were displayed
    eventService.emit('share:answers-displayed');
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
    const score = this.gameData.score;
    const maxScore = this.gameData.allAnswers ? 
      this.gameData.allAnswers.reduce((sum, a) => sum + a.points, 0) : 
      100; // fallback

    const text = `I scored ${score} out of ${maxScore} points in Guess What! Can you beat my score?`;
    const url = window.location.href;

    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
    
    // Emit share event
    eventService.emit('share:shared', {
      platform: 'twitter',
      score,
      maxScore
    });
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
    
    // Emit share event
    eventService.emit('share:shared', {
      platform: 'clipboard',
      url
    });
  }
}

export default ShareStep;