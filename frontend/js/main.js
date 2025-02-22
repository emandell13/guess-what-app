import Game from './game.js';
import UI from './ui.js';
import Guessing from './guessing.js';
import Voting from './voting.js';

document.addEventListener("DOMContentLoaded", async () => {
    const game = new Game();
    const ui = new UI();
    
    // Initialize game
    const questionData = await game.fetchTodaysQuestion();
    if (questionData.success) {
        ui.createAnswerBoxes(questionData.answerCount);
    }
    game.fetchTomorrowsQuestion();

    // Initialize game modules
    new Guessing(game, ui);
    new Voting(game);
});