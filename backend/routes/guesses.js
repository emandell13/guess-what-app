const express = require('express');
const router = express.Router();
const guessService = require('../services/guessService');
const visitorService = require('../services/visitorService');
const voteService = require('../services/voteService');
const supabase = require('../config/supabase');
const gameConstants = require('../config/gameConstants');

router.get('/question', async (req, res) => {
    try {
        const question = await guessService.getCurrentQuestion();
        // Fetch only the top 5 answers now, since that's all we need
        const top5Answers = await guessService.getTopAnswers(question.id, gameConstants.DEFAULT_ANSWER_COUNT);
        
        // Calculate total votes for the available top answers (might be fewer than 5)
        const totalVotesTop5 = top5Answers.reduce((sum, answer) => sum + answer.vote_count, 0);

        // Get total votes for reference
        const totalVotes = await voteService.getTotalVotes(question.id);

        // Max points is always 100 now
        const maxPoints = gameConstants.MAX_POINTS;

        const response = {
            id: question.id,
            question: question.question_text,
            guessPrompt: question.guess_prompt,
            totalVotes,
            totalVotesTop5,
            maxPoints,
            answerCount: top5Answers.length // This will correctly report available answers
        };

        if (req.query.includeAnswers === 'true') {
            // If there are answers, calculate the points proportionally
            if (top5Answers.length > 0 && totalVotesTop5 > 0) {
                response.answers = top5Answers.map(answer => ({
                    rank: answer.rank,
                    answer: answer.answer,
                    rawVotes: answer.vote_count,
                    points: Math.round((answer.vote_count / totalVotesTop5) * 100)
                }));
            } else {
                response.answers = [];
            }
        }

        res.json(response);
    } catch (error) {
        console.error('Error fetching question:', error);
        res.status(500).json({ error: 'Failed to fetch question' });
    }
});

router.post('/', async (req, res) => {
    try {
        const { guess, visitorId } = req.body;
        
        // Extract user ID from auth header if present
        let userId = null;
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
            const token = req.headers.authorization.split(' ')[1];
            
            try {
                const { data, error } = await supabase.auth.getUser(token);
                
                if (!error && data && data.user) {
                    userId = data.user.id;
                    console.log("Successfully extracted userId for guess:", userId);
                }
            } catch (authError) {
                console.error('Auth error (non-critical):', authError);
                // Continue without user ID
            }
        }
        
        // Ensure visitor record exists if visitorId provided
        if (visitorId) {
            await visitorService.ensureVisitorExists(visitorId, userId);
        }
        
        console.log(`Processing guess: userId=${userId}, visitorId=${visitorId}, guess=${guess}`);
        
        const result = await guessService.checkGuess(guess, userId, visitorId);
        res.json(result);
    } catch (error) {
        console.error('Error processing guess:', error);
        res.status(500).json({ error: 'Failed to process guess' });
    }
});

module.exports = router;