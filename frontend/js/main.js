// Import services
import gameService from './services/GameService.js';
import voteService from './services/VoteService.js';

// Import components
import AnswerGrid from './components/AnswerGrid.js';
import GuessForm from './components/GuessForm.js';
import ScoreTracker from './components/ScoreTracker.js';
import StrikeCounter from './components/StrikeCounter.js';
import GameModal from './components/Modal/GameModal.js';

// Main application initialization
document.addEventListener("DOMContentLoaded", async () => {
    // Initialize components
    const answerGrid = new AnswerGrid("answer-boxes");
    const scoreTracker = new ScoreTracker("current-score", "max-score");
    const strikeCounter = new StrikeCounter("strikes", 3);
    const gameModal = new GameModal("gameCompleteModal");
    
    // Initialize question heading
    const questionHeading = document.querySelector("h2");
    
    // Register callbacks from GameService
    gameService.registerScoreChangeCallback((currentScore, maxScore) => {
        scoreTracker.updateScore(currentScore, maxScore);
    });
    
    gameService.registerStrikeAddedCallback((strikes) => {
        strikeCounter.updateStrikes(strikes, true);
        
        // If max strikes reached, reveal all remaining answers
        if (strikes >= 3) {
            revealAllRemainingAnswers();
        }
    });
    
    gameService.registerGameCompleteCallback(() => {
        // Show game complete modal
        gameModal.show(gameService.currentScore);
    });
    
    // Initialize game
    const gameInitResult = await gameService.initialize();
    
    // Update the UI with initial game state
    if (gameInitResult.success) {
        // Update question text
        questionHeading.textContent = gameService.getQuestionText();
        
        // Create answer boxes
        answerGrid.initialize(gameInitResult.answerCount);
        
        // Update score display
        scoreTracker.updateScore(gameService.currentScore, gameService.maxPoints);
        
        // Update strikes display
        strikeCounter.updateStrikes(gameService.strikes, false);
        
        // If game is already restored as complete, show completion modal
        if (gameService.isGameOver()) {
            console.log("Game is already over, showing completion modal");
            gameModal.show(gameService.currentScore);
        }
        
        // For any already guessed answers, reveal them in the UI
        gameService.correctGuesses.forEach(guess => {
            answerGrid.revealAnswer(guess.rank, guess.guess, guess.points, guess.guess);
        });
    } else {
        // No active question available
        questionHeading.textContent = "No question available for guessing yet";
    }
    
    // Fetch tomorrow's question for voting
    await voteService.fetchTomorrowsQuestion();
    
    // Initialize guess form with handlers
    const guessForm = new GuessForm("guess-form", 
        // Correct guess handler
        (rank, guess, points, canonicalAnswer) => {
            answerGrid.revealAnswer(rank, guess, points, canonicalAnswer);
        },
        // Incorrect guess handler
        () => {
            // No additional action needed as strike is already added via GameService
        },
        // Already guessed handler
        (answer) => {
            showAlreadyGuessedMessage(answer);
        }
    );
    
    /**
     * Shows a temporary message when an answer was already guessed
     */
    function showAlreadyGuessedMessage(answer) {
        // Create a temporary message
        const messageContainer = document.createElement("div");
        messageContainer.className = "alert alert-warning already-guessed-alert";
        messageContainer.style.position = "fixed";
        messageContainer.style.top = "20px";
        messageContainer.style.left = "50%";
        messageContainer.style.transform = "translateX(-50%)";
        messageContainer.style.zIndex = "1050";
        messageContainer.style.padding = "10px 20px";
        messageContainer.style.borderRadius = "5px";
        messageContainer.style.boxShadow = "0 4px 8px rgba(0,0,0,0.1)";
        messageContainer.textContent = `You've already guessed "${answer}"!`;
        
        // Add to the body
        document.body.appendChild(messageContainer);
        
        // Remove after a delay
        setTimeout(() => {
            messageContainer.style.opacity = "0";
            messageContainer.style.transition = "opacity 0.5s ease";
            setTimeout(() => document.body.removeChild(messageContainer), 500);
        }, 2000);
    }
    
    /**
     * Reveals all remaining answers when the game is over
     */
    async function revealAllRemainingAnswers() {
        const response = await fetch("/guesses/question?includeAnswers=true");
        const data = await response.json();
        
        // Filter out already guessed answers
        const remainingAnswers = data.answers.filter(answer => 
            !gameService.correctGuesses.some(guess => guess.rank === answer.rank)
        );
        
        // Reveal all remaining answers with staggered animations
        await answerGrid.revealAllRemaining(remainingAnswers);
        
        // Disable guess form after revealing all
        guessForm.disable();
    }
});