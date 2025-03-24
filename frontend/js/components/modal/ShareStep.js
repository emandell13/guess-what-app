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
    this.shareHundredsDigit = this.stepElement.querySelector('#shareHundredsDigit');
    this.shareTensDigit = this.stepElement.querySelector('#shareTensDigit');
    this.shareOnesDigit = this.stepElement.querySelector('#shareOnesDigit');
    this.shareableAsset = this.stepElement.querySelector('#shareableAsset');
    this.shareQuestionText = this.stepElement.querySelector('#shareQuestionText');
    this.shareScoreValue = this.stepElement.querySelector('#shareScoreValue');
    this.shareMaxScore = this.stepElement.querySelector('#shareMaxScore');
    this.answerBoxes = this.stepElement.querySelectorAll('.answer-box');

    // Game state cache
    this.gameData = {
      score: 0,
      maxPoints: 0,
      questionText: '',
      correctAnswers: []
    };

    // Set up event listeners
    this.setupEventListeners();

    // Set up share buttons event listeners
    this.setupShareButtons();
  }

  /**
   * Sets up event listeners for game events
   */
  /**
 * Sets up event listeners for game events
 */
  setupEventListeners() {
    // Listen for score changes
    eventService.on('game:score-change', (event) => {
      const { currentScore, maxPoints } = event.detail;
      console.log("Score change event, maxPoints:", maxPoints);
      this.gameData.score = currentScore;
      if (maxPoints !== undefined) {
        this.gameData.maxPoints = maxPoints;
        // Update UI immediately if visible
        if (this.stepElement.style.display === 'block' && this.shareMaxScore) {
          this.shareMaxScore.textContent = maxPoints;
        }
      }
    });

    // Listen for answers revealed
    eventService.on('game:answer-revealed', (event) => {
      const { rank } = event.detail;

      // Store the revealed answer rank
      if (!this.gameData.correctAnswers.includes(rank)) {
        this.gameData.correctAnswers.push(rank);
      }
    });

    // Listen for game completed event
    eventService.on('game:completed', (event) => {
      const { currentScore, maxPoints, correctGuesses } = event.detail;
      console.log("Game completed event, maxPoints:", maxPoints);
      this.gameData.score = currentScore;
      if (maxPoints !== undefined) {
        this.gameData.maxPoints = maxPoints;
      }
      this.gameData.correctAnswers = correctGuesses.map(guess => guess.rank);

      // Fetch question text if not available
      if (!this.gameData.questionText) {
        this.fetchQuestionText();
      }

      // We can set a default if we still don't have maxPoints
      if (!this.gameData.maxPoints && this.shareMaxScore) {
        this.gameData.maxPoints = 99;  // Use a reasonable default
      }
    });

    // Listen for game initialized
    eventService.on('game:initialized', (event) => {
      console.log("Game initialized event:", event.detail);
      const { question, maxPoints } = event.detail;
      if (question && question.question) {
        this.gameData.questionText = question.question;
      }
      if (maxPoints !== undefined) {
        this.gameData.maxPoints = maxPoints;
      }
    });
  }

  show() {
    this.stepElement.style.display = 'block';
  
    // Try to get data from game service or DOM if available
    try {
      // Look for game service in window.app
      const gameService = window.app ? window.app.gameService : null;
      if (gameService) {
        // Update from game service if available
        this.gameData.score = gameService.currentScore || 0;
        this.gameData.maxPoints = gameService.maxPoints || 99;
        if (gameService.correctGuesses) {
          this.gameData.correctAnswers = gameService.correctGuesses.map(guess => guess.rank);
        }
        this.gameData.questionText = gameService.question ? gameService.question.question : '';
      } else {
        // Fallback: try to get data from DOM elements
        const currentScoreElement = document.getElementById('current-score');
        const maxScoreElement = document.getElementById('max-score');
  
        if (currentScoreElement) {
          this.gameData.score = parseInt(currentScoreElement.textContent) || 0;
        }
  
        if (maxScoreElement) {
          this.gameData.maxPoints = parseInt(maxScoreElement.textContent) || 99;
        }
  
        // Try to get correct answers from the game display
        const revealedAnswers = document.querySelectorAll('#answer-boxes .card-body.bg-success');
        if (revealedAnswers.length > 0) {
          this.gameData.correctAnswers = Array.from(revealedAnswers).map(el => {
            const rankEl = el.querySelector('.answer-rank');
            return rankEl ? parseInt(rankEl.textContent) : null;
          }).filter(rank => rank !== null);
        }
      }
    } catch (error) {
      console.error('Error getting game state:', error);
      // Use defaults if there's an error
      this.gameData.maxPoints = 99;
    }
  
    // Update the content with whatever data we have
    this.updateContent();
  }

  /**
   * Hides this step
   */
  hide() {
    this.stepElement.style.display = 'none';
  }

  updateContent() {
    // Update question text
    this.updateQuestionText();
  
    // Update score
    this.updateScore(this.gameData.score);
  
    // Make sure we have a valid maxPoints value
    if (this.shareMaxScore) {
      // Use stored value, or 99 as fallback
      const maxPoints = this.gameData.maxPoints || 99;
      this.shareMaxScore.textContent = maxPoints;
    }
  
    // Update answer boxes
    this.updateAnswerBoxes();
  
    // Make sure we have the latest data
    if (!this.gameData.questionText) {
      this.fetchQuestionText();
    }
  }

  /**
   * Fetches the question text from the API if not already available
   */
  async fetchQuestionText() {
    try {
      const response = await fetch("/guesses/question");
      const data = await response.json();

      if (data.question) {
        this.gameData.questionText = data.question;
        this.updateQuestionText();
      }
    } catch (error) {
      console.error("Error fetching question text:", error);
    }
  }

  /**
   * Updates the question text in the shareable asset
   */
  updateQuestionText() {
    if (this.gameData.questionText) {
      this.shareQuestionText.textContent = this.gameData.questionText;
    } else {
      this.shareQuestionText.textContent = "What did people say was...";
    }
  }

  /**
   * Updates the answer boxes based on correct guesses
   */
  updateAnswerBoxes() {
    // Reset all boxes first
    this.answerBoxes.forEach(box => {
      box.classList.remove('correct');
    });

    // Mark the correct ones
    this.gameData.correctAnswers.forEach(rank => {
      const box = this.stepElement.querySelector(`.answer-box[data-rank="${rank}"]`);
      if (box) {
        box.classList.add('correct');
      }
    });
  }
  
// Update the updateScore method to match the SummaryStep approach
updateScore(score) {
  // Get the tens and ones digits of the score
  const scoreBoxesContainer = this.shareOnesDigit.closest('.score-boxes');
  const hundredsDigitBox = this.shareHundredsDigit?.closest('.hundreds-digit-box');
  const tensDigitBox = this.shareTensDigit?.closest('.tens-digit-box');
  
  // Remove all digit-related classes
  if (scoreBoxesContainer) {
    scoreBoxesContainer.classList.remove('single-digit', 'double-digit', 'triple-digit');
  }
  
  // Split the score into digits and update display
  if (score >= 100) {
    // Triple digit scenario
    if (scoreBoxesContainer) scoreBoxesContainer.classList.add('triple-digit');
    if (hundredsDigitBox) hundredsDigitBox.style.display = 'flex';
    
    const scoreStr = score.toString();
    this.shareHundredsDigit.textContent = scoreStr[0];
    this.shareTensDigit.textContent = scoreStr[1];
    this.shareOnesDigit.textContent = scoreStr[2];
  } else if (score >= 10) {
    // Double digit scenario
    if (scoreBoxesContainer) scoreBoxesContainer.classList.add('double-digit');
    if (hundredsDigitBox) hundredsDigitBox.style.display = 'none';
    
    const scoreStr = score.toString();
    this.shareTensDigit.textContent = scoreStr[0];
    this.shareOnesDigit.textContent = scoreStr[1];
  } else {
    // Single digit scenario
    if (scoreBoxesContainer) scoreBoxesContainer.classList.add('single-digit');
    if (hundredsDigitBox) hundredsDigitBox.style.display = 'none';
    if (tensDigitBox) tensDigitBox.style.display = 'none';
    
    this.shareOnesDigit.textContent = score.toString();
  }
}

  /**
   * Sets up event listeners for share buttons
   */
  setupShareButtons() {
    const shareButtons = this.stepElement.querySelectorAll('.share-button');

    shareButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const platform = button.getAttribute('data-platform');
        const action = button.getAttribute('data-action');

        if (action === 'copy-link') {
          this.copyShareLink();
        } else if (platform) {
          this.shareOnPlatform(platform);
        }
      });
    });
  }

  /**
   * Shares the result on a specific platform
   * @param {string} platform - The platform to share on
   */
  /**
   * Shares the result on a specific platform
   * @param {string} platform - The platform to share on
   */
  shareOnPlatform(platform) {
    // First generate an image of the shareable asset
    this.generateShareImage().then(imageUrl => {
      // Create the share text
      const score = this.gameData.score;
      const maxScore = this.gameData.maxPoints;
      const text = `I scored ${score} out of ${maxScore} points in Guess What! Can you beat my score?`;
      const url = window.location.href;

      // Platform-specific URLs
      let shareUrl;

      switch (platform) {
        case 'twitter':
          shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
          window.open(shareUrl, '_blank');

          if (imageUrl) {
            this.downloadImage(imageUrl, 'guesswhat-score.png');
            setTimeout(() => {
              alert('Your score has been shared to Twitter! The image has been downloaded to your device. Please attach it to your tweet.');
            }, 500);
          }
          break;

        case 'facebook':
          // For Facebook, just download the image and direct to Facebook homepage
          if (imageUrl) {
            this.downloadImage(imageUrl, 'guesswhat-score.png');
            setTimeout(() => {
              alert('Your score image has been downloaded. We\'ll now take you to Facebook where you can create a new post and attach this image.');
              // Direct to Facebook's homepage or composer if possible
              window.open('https://www.facebook.com/', '_blank');
            }, 500);
          } else {
            // If no image, just go to Facebook
            window.open('https://www.facebook.com/', '_blank');
          }
          break;

        case 'reddit':
          // Specify a default subreddit (replace 'gaming' with your preferred subreddit)
          const subreddit = 'gaming';
          shareUrl = `https://www.reddit.com/r/${subreddit}/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(text)}`;
          window.open(shareUrl, '_blank');

          if (imageUrl) {
            this.downloadImage(imageUrl, 'guesswhat-score.png');
            setTimeout(() => {
              alert('Your score has been shared to Reddit! The image has been downloaded to your device. Please attach it to your post.');
            }, 500);
          }
          break;

        case 'bluesky':
          // Currently no direct sharing API for Bluesky
          shareUrl = `https://bsky.app`;
          window.open(shareUrl, '_blank');

          if (imageUrl) {
            this.downloadImage(imageUrl, 'guesswhat-score.png');
            setTimeout(() => {
              alert('To share on Bluesky, please create a new post and attach the image that has been downloaded to your device.');
            }, 500);
          }
          break;

        case 'instagram':
          // Instagram doesn't have a web sharing API
          if (imageUrl) {
            this.downloadImage(imageUrl, 'guesswhat-score.png');
            setTimeout(() => {
              alert('To share on Instagram, please upload the downloaded image through the Instagram app on your phone.');
            }, 500);
          }
          break;
      }

      // Emit share event
      eventService.emit('share:shared', {
        platform,
        score,
        maxScore,
        imageUrl
      });
    }).catch(error => {
      console.error("Error generating share image:", error);

      // Fallback to text-only sharing if image generation fails
      const score = this.gameData.score;
      const maxScore = this.gameData.maxPoints;
      const text = `I scored ${score} out of ${maxScore} points in Guess What! Can you beat my score?`;
      const url = window.location.href;

      let shareUrl = null;
      switch (platform) {
        case 'twitter':
          shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
          break;
        case 'facebook':
          shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(text)}`;
          break;
        case 'reddit':
          const subreddit = 'gaming';
          shareUrl = `https://www.reddit.com/r/${subreddit}/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(text)}`;
          break;
        case 'bluesky':
          shareUrl = `https://bsky.app`;
          break;
      }

      if (shareUrl) {
        window.open(shareUrl, '_blank');
      }
    });
  }

  /**
   * Downloads an image from a data URL
   * @param {string} dataUrl - The data URL of the image
   * @param {string} fileName - The file name to save as
   */
  downloadImage(dataUrl, fileName) {
    // Create a download link and trigger a click
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  async generateShareImage() {
    try {
      // Check if html2canvas is available
      if (typeof html2canvas === 'undefined') {
        console.error('html2canvas library not loaded');
        return null;
      }

      // Generate canvas from the shareable asset element
      const canvas = await html2canvas(this.shareableAsset, {
        backgroundColor: '#ffffff',
        scale: 2, // 2x scale for better quality
        logging: false,
        useCORS: true
      });

      // Convert canvas to data URL
      const dataUrl = canvas.toDataURL('image/png');

      // Return the data URL
      return dataUrl;

    } catch (error) {
      console.error("Error generating image:", error);
      throw error;
    }
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

  /**
   * Creates and returns an image of the shareable asset
   * @returns {Promise<Blob>} - A promise that resolves to the image blob
   */
  async createShareImage() {
    try {
      // We would use html2canvas or a similar library here
      // As a fallback, just return a placeholder message
      return null;
    } catch (error) {
      console.error("Error creating share image:", error);
      return null;
    }
  }
}

export default ShareStep;