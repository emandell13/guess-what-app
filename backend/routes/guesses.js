const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { isFuzzyMatch, normalizeText } = require('../utils/textUtils');

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
        const { data: allTopAnswers } = await supabase
            .from('top_answers')
            .select('*')
            .eq('question_id', question.id)
            .order('rank', { ascending: true });

        // Limit to top 5 for display/guessing
        const topAnswers = allTopAnswers.filter(answer => answer.rank <= 5);

        // Calculate total votes for top 10 answers
        const top10Total = allTopAnswers.reduce((sum, answer) => sum + answer.vote_count, 0);
        
        // Calculate total votes (for display purposes)
        const totalVotes = allTopAnswers.reduce((sum, answer) => sum + answer.vote_count, 0);

        // Calculate max possible points (sum of percentages for top 5)
        const maxPoints = topAnswers.reduce((sum, answer) => {
            return sum + Math.round((answer.vote_count / top10Total) * 100);
        }, 0);

        // If includeAnswers flag is true (for strikeout), include all answers
        if (req.query.includeAnswers === 'true') {
            res.json({
                question: question.question_text,
                guessPrompt: question.guess_prompt,
                totalVotes,
                maxPoints,
                answerCount: 5, // Explicitly set to 5
                answers: topAnswers.map(answer => ({
                    rank: answer.rank,
                    answer: answer.answer,
                    rawVotes: answer.vote_count,
                    points: Math.round((answer.vote_count / top10Total) * 100)
                }))
            });
        } else {
            res.json({ 
                question: question.question_text,
                guessPrompt: question.guess_prompt,
                totalVotes,
                maxPoints,
                answerCount: 5 // Explicitly set to 5
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

        // Get top 5 answers (these are the ones players are trying to guess)
        const { data: top5Answers } = await supabase
            .from('top_answers')
            .select('*')
            .eq('question_id', question.id)
            .lte('rank', 5) // Limit to top 5
            .order('rank', { ascending: true });

        // Get all answers for score calculation (up to top 10)
        const { data: top10Answers } = await supabase
            .from('top_answers')
            .select('*')
            .eq('question_id', question.id)
            .lte('rank', 10) // Limit to top 10
            .order('rank', { ascending: true });

        // Normalize the user's guess
        const normalizedGuess = normalizeText(guess);
        
        // Check if guess matches any top 5 answer using fuzzy matching
        let matchedAnswer = null;
        for (const answer of top5Answers) {
            if (isFuzzyMatch(guess, answer.answer, 0.85)) {
                matchedAnswer = answer;
                break;
            }
        }

        // Calculate total votes among the top 10 answers
        const top10Total = top10Answers.reduce((sum, answer) => sum + answer.vote_count, 0);

        // Calculate score as percentage of top 10 answers total
        const score = matchedAnswer ? Math.round((matchedAnswer.vote_count / top10Total) * 100) : 0;

        res.json({
            isCorrect: !!matchedAnswer,
            rank: matchedAnswer?.rank || null,
            points: score,
            rawVotes: matchedAnswer?.vote_count || 0,
            canonicalAnswer: matchedAnswer?.answer || null,
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