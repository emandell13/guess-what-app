const express = require('express');
const router = express.Router();
const supabase = require('../../config/supabase');
const { getTodayDate, getTomorrowDate } = require('../../utils/dateUtils');

function computeEngagementMetrics(progressRows) {
    const totalPlays = progressRows.length;
    if (totalPlays === 0) {
        return {
            totalPlays: 0,
            uniquePlayers: 0,
            completions: 0,
            gaveUps: 0,
            abandoned: 0,
            completionRate: 0,
            abandonmentRate: 0,
            avgGuesses: 0,
            avgGuessesOnWin: 0,
            avgStrikes: 0,
            avgHintsRevealed: 0
        };
    }

    // Count an authenticated user once and an anonymous visitor once. A player
    // with both a user_id and a visitor_id on the same row still counts once.
    const playerKeys = new Set(
        progressRows.map(p => p.user_id ? `u:${p.user_id}` : `v:${p.visitor_id}`)
    );

    const wins = progressRows.filter(p => p.completed && !p.gave_up);
    const completions = wins.length;
    const gaveUps = progressRows.filter(p => p.gave_up).length;
    const abandoned = totalPlays - completions - gaveUps;

    const sum = (rows, key) => rows.reduce((s, r) => s + (r[key] || 0), 0);

    return {
        totalPlays,
        uniquePlayers: playerKeys.size,
        completions,
        gaveUps,
        abandoned,
        completionRate: completions / totalPlays,
        abandonmentRate: abandoned / totalPlays,
        avgGuesses: sum(progressRows, 'total_guesses') / totalPlays,
        avgGuessesOnWin: wins.length > 0 ? sum(wins, 'total_guesses') / wins.length : 0,
        avgStrikes: sum(progressRows, 'strikes') / totalPlays,
        avgHintsRevealed: sum(progressRows, 'hints_revealed') / totalPlays
    };
}

// Get all questions
router.get('/', async (req, res) => {
    try {
        const { data: questions, error } = await supabase
            .from('questions')
            .select('*')
            .order('active_date', { ascending: false });

        if (error) throw error;
        
        // Calculate and add status to each question
        const today = getTodayDate();
        const tomorrow = getTomorrowDate();
        
        const questionsWithStatus = questions.map(question => {
            let status = 'upcoming';
            
            if (question.active_date === today && question.voting_complete) {
                status = 'active'; // Today's question, available for guessing
            } else if (question.active_date === tomorrow && !question.voting_complete) {
                status = 'voting'; // Tomorrow's question, currently in voting phase
            } else if (question.active_date < today && question.voting_complete) {
                status = 'completed'; // Past question
            }
            
            return {
                ...question,
                status
            };
        });
        
        res.json({ questions: questionsWithStatus });
    } catch (error) {
        console.error('Error fetching questions:', error);
        res.status(500).json({ error: 'Failed to fetch questions' });
    }
});

// Create a new question
router.post('/', async (req, res) => {
    try {
        const { question_text, guess_prompt, active_date } = req.body;
        
        const { data, error } = await supabase
            .from('questions')
            .insert([{ 
                question_text, 
                guess_prompt,
                active_date,
                voting_complete: false
            }])
            .select();

        if (error) throw error;
        res.json({ message: 'Question created successfully', question: data[0] });
    } catch (error) {
        console.error('Error creating question:', error);
        res.status(500).json({ error: 'Failed to create question' });
    }
});

// Get a single question with its top answers
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Get the question
        const { data: question, error } = await supabase
            .from('questions')
            .select('*')
            .eq('id', id)
            .single();
            
        if (error) throw error;
        
        // Get top answers if they exist
        const { data: topAnswers, error: answersError } = await supabase
            .from('top_answers')
            .select('*')
            .eq('question_id', id)
            .order('rank', { ascending: true });
            
        if (answersError) throw answersError;
        
        // Get all votes for this question
        const { data: votes, error: votesError } = await supabase
            .from('votes')
            .select('response')
            .eq('question_id', id);
            
        if (votesError) throw votesError;
        
        // Calculate vote distribution
        const voteDistribution = {};
        votes.forEach(vote => {
            const response = vote.response.trim().toLowerCase();
            voteDistribution[response] = (voteDistribution[response] || 0) + 1;
        });
        
        // Convert to array and sort by count (descending)
        const sortedVotes = Object.entries(voteDistribution)
            .map(([response, count]) => ({ response, count }))
            .sort((a, b) => b.count - a.count);
        
        // Get vote count
        const voteCount = votes.length;

        // Engagement metrics — per-question aggregation over game_progress.
        // Drives the admin analytics view so we can see which questions
        // actually landed (completion rate, abandonment, hint reliance).
        const { data: progress, error: progressError } = await supabase
            .from('game_progress')
            .select('user_id, visitor_id, total_guesses, strikes, completed, gave_up, hints_revealed')
            .eq('question_id', id);

        if (progressError) throw progressError;

        const engagement = computeEngagementMetrics(progress || []);

        res.json({
            question,
            topAnswers: topAnswers || [],
            voteCount: voteCount || 0,
            voteDistribution: sortedVotes,
            engagement
        });
    } catch (error) {
        console.error('Error fetching question:', error);
        res.status(500).json({ error: 'Failed to fetch question' });
    }
});

// Update a question
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { question_text, guess_prompt, active_date, voting_complete } = req.body;
        
        const { data, error } = await supabase
            .from('questions')
            .update({ 
                question_text, 
                guess_prompt,
                active_date,
                voting_complete
            })
            .eq('id', id)
            .select();
            
        if (error) throw error;
        
        res.json({ 
            message: 'Question updated successfully', 
            question: data[0] 
        });
    } catch (error) {
        console.error('Error updating question:', error);
        res.status(500).json({ error: 'Failed to update question' });
    }
});

// Delete a question
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Delete top answers first (foreign key)
        await supabase
            .from('top_answers')
            .delete()
            .eq('question_id', id);
            
        // Delete votes for this question
        await supabase
            .from('votes')
            .delete()
            .eq('question_id', id);
            
        // Delete the question
        const { error } = await supabase
            .from('questions')
            .delete()
            .eq('id', id);
            
        if (error) throw error;
        
        res.json({ message: 'Question deleted successfully' });
    } catch (error) {
        console.error('Error deleting question:', error);
        res.status(500).json({ error: 'Failed to delete question' });
    }
});

module.exports = router;