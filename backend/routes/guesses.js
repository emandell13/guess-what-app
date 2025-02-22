const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

router.get('/question', async (req, res) => {
    try {
        // Get today's date in ET
        const et = new Date().toLocaleString("en-US", {timeZone: "America/New_York"});
        const etDate = new Date(et);
        const todayDate = etDate.getFullYear() + '-' + 
            String(etDate.getMonth() + 1).padStart(2, '0') + '-' + 
            String(etDate.getDate()).padStart(2, '0');

        // Get today's question
        const { data: question } = await supabase
            .from('questions')
            .select('*')
            .eq('active_date', todayDate)
            .eq('voting_complete', true)
            .single();

        if (!question) {
            return res.status(404).json({ 
                error: 'No question available for guessing yet' 
            });
        }

        // Get top answers with their vote counts
        const { data: topAnswers } = await supabase
            .from('top_answers')
            .select('*')
            .eq('question_id', question.id)
            .order('rank', { ascending: true });

        // Calculate total votes and points
        const totalVotes = topAnswers.reduce((sum, answer) => sum + answer.vote_count, 0);
        const maxPoints = totalVotes; // Each vote is worth 1 point

        // If includeAnswers flag is true (for strikeout), include all answers
        if (req.query.includeAnswers === 'true') {
            res.json({
                question: question.question_text,
                totalVotes,
                maxPoints,
                answerCount: topAnswers.length,
                answers: topAnswers.map(answer => ({
                    rank: answer.rank,
                    answer: answer.answer,
                    points: answer.vote_count
                }))
            });
        } else {
            res.json({ 
                question: question.question_text,
                totalVotes,
                maxPoints,
                answerCount: topAnswers.length
            });
        }

    } catch (error) {
        console.error('Error fetching question:', error);
        res.status(500).json({ error: 'Failed to fetch question' });
    }
});

// Submit a guess
router.post('/', async (req, res) => {
    try {
        const { guess } = req.body;
        
        // Get today's question and its answers (same date logic as above)
        const et = new Date().toLocaleString("en-US", {timeZone: "America/New_York"});
        const etDate = new Date(et);
        const todayDate = etDate.getFullYear() + '-' + 
            String(etDate.getMonth() + 1).padStart(2, '0') + '-' + 
            String(etDate.getDate()).padStart(2, '0');

        // Get today's question
        const { data: question } = await supabase
            .from('questions')
            .select('*')
            .eq('active_date', todayDate)
            .eq('voting_complete', true)
            .single();

        if (!question) {
            return res.status(400).json({ 
                error: 'No question available for guessing' 
            });
        }

        // Get top answers
        const { data: topAnswers } = await supabase
            .from('top_answers')
            .select('*')
            .eq('question_id', question.id);

        // Check if guess matches any top answer
        const normalizedGuess = guess.toLowerCase().trim();
        const matchedAnswer = topAnswers.find(
            answer => answer.answer.toLowerCase().trim() === normalizedGuess
        );

        res.json({
            isCorrect: !!matchedAnswer,
            rank: matchedAnswer?.rank || null,
            points: matchedAnswer?.vote_count || 0,
            message: matchedAnswer 
                ? `Correct! This was answer #${matchedAnswer.rank}` 
                : 'Try again!'
        });

    } catch (error) {
        console.error('Error processing guess:', error);
        res.status(500).json({ error: 'Failed to process guess' });
    }

    
});

module.exports = router;