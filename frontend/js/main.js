// Import services
import gameService from './services/GameService.js';
import voteService from './services/VoteService.js';
import authService from './services/AuthService.js';
import visitorService from './services/VisitorService.js';
import eventService from './services/EventService.js';

// Import components
import AnswerGrid from './components/AnswerGrid.js';
import GuessForm from './components/GuessForm.js';
import StrikeCounter from './components/StrikeCounter.js';
import GameModal from './components/modal/GameModal.js';
import AuthModal from './components/modal/AuthModal.js';
import HintButton from './components/HintButton.js';
import CommentaryOverlay from './components/CommentaryOverlay.js';
import ClosenessFeedback from './components/ClosenessFeedback.js';
import AlreadyGuessedFeedback from './components/AlreadyGuessedFeedback.js';

/**
 * Main application class
 */
class App {
  constructor() {
    // Initialize components
    this.isGameOverModalPending = false;
    this.answerGrid = new AnswerGrid("answer-boxes");
    this.strikeCounter = new StrikeCounter("strikes");
    this.gameModal = new GameModal("gameCompleteModal");
    this.authModal = new AuthModal();
    this.questionHeading = document.querySelector("h2");
    this.hintButton = new HintButton();
    this.commentaryOverlay = new CommentaryOverlay();
    this.closenessFeedback = new ClosenessFeedback();
    this.alreadyGuessedFeedback = new AlreadyGuessedFeedback();
    this.hasCelebratedPerfectGame = false; // Flag to track if perfect game celebration has occurred

    // Setup event listeners
    this.setupEventListeners();

    // Setup auth button click handler
    this.setupAuthButton();

    // Setup mobile keyboard handling
    this.setupMobileKeyboardHandling();

    // Register this visitor
    this.registerVisitor();
  }

  /**
   * Setup mobile keyboard handling for the three-zone shell.
   *
   * Writes --viewport-h (= visualViewport.height) to the root so the
   * shell in styles.css sizes exactly to the visual viewport. When the
   * keyboard opens the visual viewport shrinks and the shell shrinks
   * with it, keeping the header pinned and the input just above the keys.
   *
   * Also force-resets window scroll on input focus to counteract iOS
   * Safari's auto-scroll-into-view, which otherwise yanks the "fixed"
   * header up even though overflow is hidden.
   */
  setupMobileKeyboardHandling() {
    if (!window.matchMedia('(max-width: 767.98px)').matches) return;
    if (!window.visualViewport) return;

    const root = document.documentElement;
    let rafId = null;

    const applyHeight = () => {
      rafId = null;
      root.style.setProperty('--viewport-h', `${window.visualViewport.height}px`);
    };

    const schedule = () => {
      if (rafId != null) return;
      rafId = requestAnimationFrame(applyHeight);
    };

    window.visualViewport.addEventListener('resize', schedule);
    window.visualViewport.addEventListener('scroll', schedule);
    applyHeight();

    const input = document.querySelector('#guess-form input');
    if (input) {
      const pinScroll = () => window.scrollTo(0, 0);
      input.addEventListener('focus', () => {
        pinScroll();
        setTimeout(pinScroll, 50);
        setTimeout(pinScroll, 200);
      });
    }

    // Host commentary + closeness-feedback bubbles live in <body> by
    // default and position: fixed relative to the layout viewport. On
    // mobile the shell covers only the visual viewport, so fixed bottom
    // offsets hide them behind the keyboard. Relocate into the input
    // zone so their absolute positioning anchors just above the input.
    const inputZone = document.querySelector('.mobile-input-zone');
    if (inputZone) {
      const commentary = document.getElementById('commentary-overlay');
      const closeness = document.getElementById('closeness-feedback');
      if (commentary) inputZone.appendChild(commentary);
      if (closeness) inputZone.appendChild(closeness);
    }
  }

  /**
   * Register the current visitor
   */
  async registerVisitor() {
    try {
      await visitorService.registerVisitor();
    } catch (error) {
      console.error("Error registering visitor:", error);
      // Silent failure - don't interrupt the app initialization
    }
  }

  setupAuthButton() {
    const authButton = document.getElementById('auth-button');
    if (authButton) {
      authButton.addEventListener('click', () => {
        // Check if the user is authenticated
        if (authService.isAuthenticated()) {
          this.authModal.showProfile();
        } else {
          this.authModal.showLogin();
        }
      });

      // Update button text based on auth state
      this.updateAuthButton();

      // Listen for auth state changes
      eventService.on('auth:login', () => this.updateAuthButton());
      eventService.on('auth:logout', () => this.updateAuthButton());
    }
  }

  /**
   * Set up event listeners for game events
   */
  setupEventListeners() {
    // Listen for correct guesses
    eventService.on('game:answer-revealed', (event) => {
      const { guess, rank, voteCount, canonicalAnswer } = event.detail;
      this.answerGrid.revealAnswer(rank, guess, voteCount, canonicalAnswer);
    });

    eventService.on('game:initialized', () => {
      this.hasCelebratedPerfectGame = false;
      const chromeRow = document.getElementById('game-chrome-row');
      if (chromeRow) chromeRow.classList.remove('pre-init');
    });

    // Listen for strike-out (3 strikes = game over)
    eventService.on('game:struck-out', async () => {
      console.log("Player struck out, revealing all remaining answers");

      if (this.guessForm) this.guessForm.disable();

      document.body.dataset.revealingAnswers = 'true';

      try {
        await this.revealAllRemainingAnswers();
      } catch (error) {
        console.error("Error revealing answers after strike-out:", error);
      } finally {
        document.body.dataset.revealingAnswers = 'false';
        this.gameModal.show(gameService.totalGuesses, false);
      }
    });

    eventService.on('game:perfect-game', () => {
      this.celebratePerfectGame();
    });

    // Listen for user giving up
    eventService.on('game:gave-up', async (event) => {
      const { remainingAnswers } = event.detail;
      console.log("User gave up, revealing all remaining answers");

      // Disable form
      if (this.guessForm) this.guessForm.disable();

      // Signal that animations are in progress
      document.body.dataset.revealingAnswers = 'true';

      try {
        // Reveal all remaining answers with animations
        await this.answerGrid.revealAllRemaining(remainingAnswers);
      } catch (error) {
        console.error("Error revealing answers:", error);
      } finally {
        // IMPORTANT: Always reset the flag, even if there's an error
        document.body.dataset.revealingAnswers = 'false';

        // Show the game over modal - passing gaveUp=true
        if (this.gameModal.pendingGuesses !== undefined) {
          this.gameModal.show(gameService.totalGuesses, true);
          this.gameModal.pendingGuesses = undefined;
        } else {
          this.gameModal.show(gameService.totalGuesses, true);
        }
      }
    });

    // Game completed events
    eventService.on('game:completed', (event) => {
      const { totalGuesses, gaveUp } = event.detail;

      // Check if we're in the middle of a reveal sequence
      if (document.body.dataset.revealingAnswers === 'true') {
        console.log("game:completed event received but animations in progress - not showing modal yet");
        this.gameModal.pendingScore = totalGuesses;
        return;
      }

      console.log("game:completed event showing modal");
      this.gameModal.show(totalGuesses, gaveUp);

      // Disable guess form
      if (this.guessForm) this.guessForm.disable();
    });

    // Listen for game completed event and refresh streaks
    eventService.on('game:completed', async () => {
      // Refresh streak data for authenticated users
      if (authService.isAuthenticated()) {
        await streakService.handleGameCompletion();
      }
    });

    // Listen for open login modal events
    eventService.on('ui:open-login-modal', () => {
      // Close the game modal first if it's open
      if (this.gameModal) {
        const modalElement = document.getElementById('gameCompleteModal');
        const bsModal = bootstrap.Modal.getInstance(modalElement);
        if (bsModal) {
          bsModal.hide();
        }
      }

      // Then show the login modal
      setTimeout(() => {
        if (this.authModal) {
          this.authModal.showLogin();
        }
      }, 400); // Short delay to allow the game modal to close
    });

    // Listen for open register modal events (for streak signup)
    eventService.on('ui:open-register-modal', () => {
      // Close the game modal first if it's open
      if (this.gameModal) {
        const modalElement = document.getElementById('gameCompleteModal');
        const bsModal = bootstrap.Modal.getInstance(modalElement);
        if (bsModal) {
          bsModal.hide();
        }
      }

      // Then show the registration modal
      setTimeout(() => {
        if (this.authModal) {
          this.authModal.showRegister();
        }
      }, 400); // Short delay to allow the game modal to close
    });

    eventService.on('ui:open-voting-modal', (event) => {
      const isDirect = event?.detail?.direct || false;

      // Open the modal and go to voting step
      if (this.gameModal) {
        // If direct access, hide the progress bar and adjust close button
        // If direct access, replace progress bar with placeholder but keep layout intact
        if (isDirect) {
          const progressContainer = document.querySelector('#gameCompleteModal .progress-container');

          if (progressContainer) {
            // Instead of hiding it, replace its content with an invisible placeholder of same height
            progressContainer.innerHTML = '<div style="height: 1.25rem;"></div>';
          }
        }

        this.gameModal.modal.show();

        // If direct access, go directly to voting step (skip summary)
        if (isDirect) {
          this.gameModal.goToVotingStep();
        } else {
          // Normal flow - go to summary first
          this.gameModal.currentStep = 1; // Set to 1 before calling nextStep
          this.gameModal.nextStep();
        }
      }
    });
  }

  checkVerificationStatus() {
    // Only check for our custom verified parameter
    const urlParams = new URLSearchParams(window.location.search);

    if (urlParams.has('verified') && urlParams.get('verified') === 'success') {
      console.log("Verification success detected, showing login modal");
      this.authModal.showLoginWithVerificationSuccess();

      // Clean up the URL
      window.history.replaceState({}, document.title, window.location.pathname);
      return true;
    }

    return false;
  }

  /**
   * Update auth button text based on authentication state
   */
  async updateAuthButton() {
    const authButton = document.getElementById('auth-button');
    const isAuthenticated = authService.isAuthenticated();

    if (authButton) {
      if (isAuthenticated) {
        // Use Material Design icon when authenticated
        authButton.innerHTML = `<span class="material-icons">person</span>`;
      } else {
        // Use Material Design icon when not authenticated
        authButton.innerHTML = `<span class="material-icons">person</span>`;
      }
    }
  }

  /**
   * Paint a canned game state for the ?mock=1 preview URL. Replaces the
   * skeleton placeholders with a fixed question, date, and partially
   * played answer board so mobile layout can be reviewed without a
   * live game. Never reachable in prod outside the mock URL.
   */
  paintMockState() {
    const date = document.getElementById('question-date');
    if (date) date.textContent = 'Sunday, April 19';

    this.questionHeading.textContent = "Name something you'd bring to a picnic.";

    const chrome = document.getElementById('game-chrome-row');
    if (chrome) chrome.classList.remove('pre-init');

    const boxes = document.getElementById('answer-boxes');
    if (!boxes) return;
    const mock = [
      { rank: 1, text: 'Sandwiches', points: 42, solved: true },
      { rank: 2, text: 'Blanket', points: 28, solved: true },
      { rank: 3, text: '', points: 0, solved: false },
      { rank: 4, text: '', points: 0, solved: false },
      { rank: 5, text: '', points: 0, solved: false },
    ];
    boxes.innerHTML = mock.map(m => `
      <div class="col-12 answer-box">
        <div class="card w-100">
          <div class="card-body d-flex justify-content-between align-items-center ${m.solved ? 'bg-success bg-opacity-25' : 'bg-light'}">
            <div class="d-flex align-items-center w-100 answer-content">
              <span class="answer-rank">${m.rank}</span>
              <span class="answer-text ${m.solved ? 'visible' : ''} flex-grow-1 text-center h5 mb-0">${m.text}</span>
              <span class="points badge ${m.solved ? '' : 'd-none'}">${m.solved ? m.points : '0 pts'}</span>
            </div>
          </div>
        </div>
      </div>
    `).join('');
  }

  /**
 * Initialize the application
 */
  async initialize() {
    // Reset celebration flag for new games
    this.hasCelebratedPerfectGame = false;

    // ?mock=1 skips game/server init and paints a canned mock state so
    // the full mobile layout can be previewed without playing a game.
    // Prod users never see this — it only activates via the URL flag.
    if (new URLSearchParams(window.location.search).get('mock') === '1') {
      this.paintMockState();
      return;
    }

    // Initialize game
    const gameInitResult = await gameService.initialize();

    // Update the UI with initial game state
    if (gameInitResult.success) {
      this.updateInitialUI(gameInitResult.answerCount);
    } else {
      // No active question available — clear skeleton placeholders
      this.questionHeading.textContent = "No question available for guessing yet";
      const dateEl = document.getElementById('question-date');
      if (dateEl) dateEl.remove();
      const answerBoxes = document.getElementById('answer-boxes');
      if (answerBoxes) answerBoxes.innerHTML = '';
    }

    // Fetch tomorrow's question for voting
    await voteService.fetchTomorrowsQuestion();

    // Initialize guess form - using the new event-based system
    this.guessForm = new GuessForm("guess-form");

    // Check for verification parameter after everything is initialized
    this.checkVerificationStatus();
  }

  /**
   * Update UI with initial game state
   */
  updateInitialUI(answerCount) {
    // Create date display before setting question text
    const questionContainer = this.questionHeading.parentElement;

    // Check if date display already exists
    let dateDisplay = document.getElementById('question-date');
    if (!dateDisplay) {
      dateDisplay = document.createElement('h5');
      dateDisplay.className = 'text-center mb-3';
      dateDisplay.id = 'question-date';

      // Insert date display before the question heading
      if (questionContainer) {
        questionContainer.insertBefore(dateDisplay, this.questionHeading);
      }
    }

    // Set the date text
    dateDisplay.innerText = gameService.getFormattedActiveDate();

    // Set the question text
    this.questionHeading.innerHTML = gameService.getQuestionText();

    // Add click event listener to the people count element
    const peopleCountElement = document.getElementById('people-count');
    if (peopleCountElement) {
      peopleCountElement.addEventListener('click', () => {
        // Emit an event to open the voting modal
        eventService.emit('ui:open-voting-modal', { direct: true });
      });
    }

    // Create answer boxes
    this.answerGrid.initialize(answerCount);

    // Restore strike display for resumed games
    this.strikeCounter.updateStrikes(gameService.incorrectGuesses.length, false);

    // If game is already restored as complete, handle accordingly
    if (gameService.isGameOver()) {
      console.log("Game is already over, showing completion modal");

      // Reveal remaining answers if game ended without all answers found
      if (gameService.gaveUp || gameService.hasStruckOut()) {
        this.revealAllRemainingAnswers();
      }

      // Disable form and show modal after a short delay
      setTimeout(() => {
        if (this.guessForm) this.guessForm.disable();
        this.gameModal.show(gameService.totalGuesses, gameService.gaveUp);
      }, 500);
    }

    // For any already guessed answers, reveal them in the UI.
    // Flag the restore so CommentaryOverlay stays quiet — the bubble should
    // only fire on a live #1 reveal, not on page reload.
    document.body.dataset.gameRestoring = 'true';
    gameService.correctGuesses.forEach(guess => {
      this.answerGrid.revealAnswer(guess.rank, guess.guess, guess.voteCount, guess.guess);
    });
    delete document.body.dataset.gameRestoring;
  }


  /**
   * Reveals all remaining answers when the game is over
   * @returns {Promise} A promise that resolves when all answers are revealed
   */
  async revealAllRemainingAnswers() {
    try {
      console.log("Starting reveal of remaining answers");
      const response = await fetch("/guesses/question?includeAnswers=true");
      const data = await response.json();

      // Filter out already guessed answers
      const alreadyGuessedRanks = gameService.correctGuesses.map(guess => guess.rank);
      console.log("Already guessed ranks:", alreadyGuessedRanks);

      const remainingAnswers = data.answers.filter(answer =>
        !alreadyGuessedRanks.includes(answer.rank)
      ).map(answer => ({
        rank: answer.rank,
        answer: answer.answer,
        voteCount: answer.rawVotes
      }));

      console.log(`Revealing ${remainingAnswers.length} remaining answers`);

      // If no answers to reveal, return immediately
      if (remainingAnswers.length === 0) {
        console.log("No remaining answers to reveal");
        return Promise.resolve();
      }

      // Reveal all remaining answers with staggered animations
      const promise = this.answerGrid.revealAllRemaining(remainingAnswers);

      // Add these debug logs
      promise.then(() => {
        console.log("All answers revealed successfully");
      }).catch(err => {
        console.error("Error in reveal animation promise:", err);
      });

      return promise;
    } catch (error) {
      console.error('Error revealing remaining answers:', error);
      return Promise.resolve(); // Return a resolved promise on error
    }

  }

  /**
 * Displays a celebration animation for a perfect game - with design-matching colors
 */
  /**
 * Displays a celebration animation for a perfect game - with bright but coordinated colors
 */
  celebratePerfectGame() {
    if (this.hasCelebratedPerfectGame) return; // Prevent multiple celebrations
    this.hasCelebratedPerfectGame = true;

    console.log("Perfect game achieved! Celebrating...");

    // Brighter, more vibrant colors that still coordinate with your design
    const colors = [
      '#4CAF50', // Bright green (vibrant version of your success color)
      '#FF5252', // Bright red (vibrant version of your alert color)
      '#FFEB3B', // Bright yellow (vibrant version of your light yellow)
      '#2196F3', // Bright blue (vibrant version of your light blue)
      '#9C27B0', // Bright purple (for contrast and celebration)
      '#FF9800'  // Bright orange (for variety and warmth)
    ];

    // First burst of confetti
    const count = 200;
    const defaults = {
      origin: { y: 0.7 },
      zIndex: 2000,
      colors: colors
    };

    function fire(particleRatio, opts) {
      confetti({
        ...defaults,
        ...opts,
        particleCount: Math.floor(count * particleRatio)
      });
    }

    // Launch confetti from the sides
    fire(0.25, {
      spread: 26,
      startVelocity: 55,
      origin: { x: 0.1, y: 0.5 }
    });
    fire(0.25, {
      spread: 26,
      startVelocity: 55,
      origin: { x: 0.9, y: 0.5 }
    });

    // Launch confetti from the bottom
    fire(0.2, {
      spread: 60,
      decay: 0.94,
      scalar: 0.9
    });

    // Delayed burst from the center
    setTimeout(() => {
      fire(0.3, {
        spread: 100,
        decay: 0.91,
        scalar: 1.2,
        origin: { y: 0.6 }
      });
    }, 500);

    // Cannon shots from alternating sides
    let intervalId = setInterval(() => {
      const side = Math.random() > 0.5 ? 0.1 : 0.9;
      confetti({
        particleCount: 20,
        angle: side === 0.1 ? 60 : 120,
        spread: 50,
        origin: { x: side, y: 0.6 },
        zIndex: 2000,
        colors: colors
      });
    }, 300);

    // Stop the interval after a few seconds
    setTimeout(() => {
      clearInterval(intervalId);
    }, 4000);
  }

}

// Application initialization
document.addEventListener("DOMContentLoaded", async () => {
  const app = new App();
  await app.initialize();
});