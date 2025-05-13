// backend/routes/guesses.js

const express = require('express');
const router = express.Router();
const guessService = require('../services/guessService');
const visitorService = require('../services/visitorService');
const voteService = require('../services/voteService');
const supabase = require('../config/supabase');
const gameConstants = require('../config/gameConstants');
const gameService = require('../services/gameService');

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
            answerCount: top5Answers.length, // This will correctly report available answers
            active_date: question.active_date // Ensure this line is present
        };

        if (req.query.includeAnswers === 'true') {
            // If there are answers, calculate the points proportionally
            if (top5Answers.length > 0 && totalVotesTop5 > 0) {
                response.answers = top5Answers.map(answer => ({
                    rank: answer.rank,
                    answer: answer.answer,
                    rawVotes: answer.vote_count,
                    hint: answer.hint, // Include hint in response
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

// New route to get hints for all answers
router.get('/hints/:questionId', async (req, res) => {
    try {
        const { questionId } = req.params;
        const hints = await guessService.getHintsForQuestion(questionId);
        res.json({ hints });
    } catch (error) {
        console.error('Error fetching hints:', error);
        res.status(500).json({ error: 'Failed to fetch hints' });
    }
});

// New route to get a hint for a specific answer
router.get('/hint/:answerId', async (req, res) => {
    try {
        const { answerId } = req.params;
        const hint = await guessService.getAnswerHint(answerId);
        res.json({ hint });
    } catch (error) {
        console.error('Error fetching hint:', error);
        res.status(500).json({ error: 'Failed to fetch hint' });
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

// Add this route to the file
router.post('/giveup', async (req, res) => {
    try {
        const { visitorId } = req.body;
        
        // Extract user ID from auth header if present
        let userId = null;
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
            const token = req.headers.authorization.split(' ')[1];
            
            try {
                const { data, error } = await supabase.auth.getUser(token);
                
                if (!error && data && data.user) {
                    userId = data.user.id;
                    console.log("Successfully extracted userId for give up:", userId);
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
        
        console.log(`Processing give up: userId=${userId}, visitorId=${visitorId}`);
        
        const result = await gameService.giveUp(userId, visitorId);
        res.json(result);
    } catch (error) {
        console.error('Error processing give up:', error);
        res.status(500).json({ error: 'Failed to process give up' });
    }
});

module.exports = router;