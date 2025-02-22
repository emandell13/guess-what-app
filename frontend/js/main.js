import Game from './game.js';
import UI from './ui.js';
import Guessing from './guessing.js';
import Voting from './voting.js';
import ModalManager from './modal-manager.js';

document.addEventListener("DOMContentLoaded", async () => {
    const ui = new UI();
    const game = new Game(ui);
    const modalManager = new ModalManager(game, ui);
    
    // Initialize game
    const questionData = await game.fetchTodaysQuestion();
    if (questionData.success) {
        ui.createAnswerBoxes(questionData.answerCount);
    }
    game.fetchTomorrowsQuestion();

    // Initialize game modules
    new Guessing(game, ui, modalManager);  // Pass modalManager to Guessing
    new Voting(game);
});