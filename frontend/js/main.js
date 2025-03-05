import Game from './game.js';
import UI from './ui.js';
import Guessing from './guessing.js';
import Voting from './voting.js';
import ModalManager from './modal-manager.js';

document.addEventListener("DOMContentLoaded", async () => {
    // Create components with cleaner dependencies
    const ui = new UI();
    const voting = new Voting();
    const game = new Game(ui);
    const modalManager = new ModalManager(ui, voting);
    const guessing = new Guessing(game, ui, modalManager);
    
    // Set game on modalManager after creation
    modalManager.setGame(game);
    
    // Initialize game
    const questionData = await game.fetchTodaysQuestion();
    if (questionData.success) {
        ui.createAnswerBoxes(questionData.answerCount);

        game.restoreGameState();

        // Check if the game is already complete and show modal if needed
        if (game.isGameOver()) {
            console.log("Game is already over, showing completion modal");
            guessing.disableGuessForm();
            modalManager.showGameComplete();
        }
    }
    
    // Fetch tomorrow's question (moved from Game to Voting)
    await voting.fetchTomorrowsQuestion();

    // Initialize guessing with all dependencies
    new Guessing(game, ui, modalManager);
});