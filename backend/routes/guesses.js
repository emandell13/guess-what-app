const express = require('express');
const router = express.Router();
const guessService = require('../services/guessService');

router.get('/question', async (req, res) => {
    try {
        const question = await guessService.getCurrentQuestion();
        const topAnswers = await guessService.getTopAnswers(question.id, 10);
        
        const totalVotes = topAnswers.reduce((sum, answer) => sum + answer.vote_count, 0);
        const maxPoints = topAnswers
            .filter(answer => answer.rank <= 5)
            .reduce((sum, answer) => sum + Math.round((answer.vote_count / totalVotes) * 100), 0);

        const response = {
            question: question.question_text,
            guessPrompt: question.guess_prompt,
            totalVotes,
            maxPoints,
            answerCount: topAnswers.filter(answer => answer.rank <= 5).length
        };

        if (req.query.includeAnswers === 'true') {
            response.answers = topAnswers
                .filter(answer => answer.rank <= 5)
                .map(answer => ({
                    rank: answer.rank,
                    answer: answer.answer,
                    rawVotes: answer.vote_count,
                    points: Math.round((answer.vote_count / totalVotes) * 100)
                }));
        }

        res.json(response);
    } catch (error) {
        console.error('Error fetching question:', error);
        res.status(500).json({ error: 'Failed to fetch question' });
    }
});

router.post('/', async (req, res) => {
    try {
        const { guess } = req.body;
        const result = await guessService.checkGuess(guess);
        res.json(result);
    } catch (error) {
        console.error('Error processing guess:', error);
        res.status(500).json({ error: 'Failed to process guess' });
    }
});

module.exports = router;
