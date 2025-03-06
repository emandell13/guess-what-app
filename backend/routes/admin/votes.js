const express = require('express');
const router = express.Router();
const supabase = require('../../config/supabase');
const { groupSimilarAnswers } = require('../../utils/textUtils');

// Tally votes for a question
router.post('/tally/:questionId', async (req, res) => {
    try {
        const { questionId } = req.params;
        const { answerCount = 10 } = req.body; // Default to 10 answers
        
        // Get all votes for this question
        const { data: votes, error: votesError } = await supabase
            .from('votes')
            .select('*')
            .eq('question_id', questionId);
            
        if (votesError) throw votesError;
        
        if (!votes || votes.length === 0) {
            return res.status(400).json({
                error: 'No votes found for this question'
            });
        }
        
        // Extract response text from votes
        const voteTexts = votes.map(vote => vote.response);
        
        // Group similar answers
        const groupedVotes = groupSimilarAnswers(voteTexts);
        
        // Convert to array and sort by count
        const sortedVotes = Object.entries(groupedVotes)
            .map(([answer, count]) => ({ answer, count }))
            .sort((a, b) => b.count - a.count);
        
        // Take top N answers (default 10)
        const topAnswers = sortedVotes.slice(0, answerCount);
        
        console.log('Tallied votes into these top answers:', topAnswers);
        
        // Clear any existing top answers first
        const { error: deleteError } = await supabase
            .from('top_answers')
            .delete()
            .eq('question_id', questionId);
            
        if (deleteError) throw deleteError;
        
        // Insert into top_answers table
        for (let i = 0; i < topAnswers.length; i++) {
            const { answer, count } = topAnswers[i];
            const rank = i + 1;
            
            await supabase
                .from('top_answers')
                .insert([{
                    question_id: questionId,
                    answer,
                    vote_count: count,
                    rank
                }]);
        }
        
        // Mark question as voting complete
        await supabase
            .from('questions')
            .update({ voting_complete: true })
            .eq('id', questionId);
        
        res.json({ 
            message: 'Votes tallied successfully', 
            topAnswers 
        });
    } catch (error) {
        console.error('Error tallying votes:', error);
        res.status(500).json({ error: 'Failed to tally votes' });
    }
});

// Add multiple votes for a question
router.post('/:questionId', async (req, res) => {
    try {
        const { questionId } = req.params;
        const { response, count = 1 } = req.body;
        
        if (!response || response.trim() === '') {
            return res.status(400).json({ error: 'Response is required' });
        }
        
        if (count < 1 || count > 1000) {
            return res.status(400).json({ error: 'Count must be between 1 and 1000' });
        }
        
        // Normalize the response to lowercase and trim
        const normalizedResponse = response.toLowerCase().trim();
        
        // Check if the question exists
        const { data: question, error: questionError } = await supabase
            .from('questions')
            .select('id')
            .eq('id', questionId)
            .single();
            
        if (questionError || !question) {
            return res.status(404).json({ error: 'Question not found' });
        }
        
        // Add the votes one by one
        const votes = [];
        for (let i = 0; i < count; i++) {
            votes.push({
                question_id: questionId,
                response: normalizedResponse,
                created_at: new Date().toISOString()
            });
        }
        
        // Insert in batches to avoid hitting any limits
        const BATCH_SIZE = 100;
        let successCount = 0;
        
        for (let i = 0; i < votes.length; i += BATCH_SIZE) {
            const batch = votes.slice(i, i + BATCH_SIZE);
            const { data, error } = await supabase
                .from('votes')
                .insert(batch);
                
            if (error) {
                console.error('Error adding votes batch:', error);
                return res.status(500).json({ 
                    error: 'Failed to add all votes',
                    successCount
                });
            }
            
            successCount += batch.length;
        }
        
        res.json({ 
            message: `Successfully added ${successCount} votes for "${response}"`,
            successCount
        });
        
    } catch (error) {
        console.error('Error adding votes:', error);
        res.status(500).json({ error: 'Failed to add votes' });
    }
});

// Get grouped vote distribution using fuzzy matching
router.get('/distribution/:questionId', async (req, res) => {
    try {
        const { questionId } = req.params;
        
        // Get all votes for this question
        const { data: votes, error: votesError } = await supabase
            .from('votes')
            .select('response')
            .eq('question_id', questionId);
            
        if (votesError) throw votesError;
        
        if (!votes || votes.length === 0) {
            return res.json({ voteGroups: [] });
        }
        
        // Extract all responses
        const responses = votes.map(vote => vote.response);
        
        // Group responses using the same fuzzy matching algorithm used for tallying
        const groupedResponses = groupSimilarAnswers(responses);
        
        // Format the result for display
        const voteGroups = Object.entries(groupedResponses).map(([canonicalAnswer, count]) => {
            // Find examples of responses that would be grouped under this canonical answer
            const examples = responses.filter(response => {
                // This is a simplified approach - ideally you'd use the same logic from groupSimilarAnswers
                const normalizedResponse = response.toLowerCase().trim();
                const normalizedCanonical = canonicalAnswer.toLowerCase().trim();
                return normalizedResponse === normalizedCanonical || 
                       normalizedResponse.includes(normalizedCanonical) || 
                       normalizedCanonical.includes(normalizedResponse);
            }).slice(0, 5); // Limit to 5 examples
            
            return {
                canonicalAnswer,
                count,
                examples: examples.length > 0 ? examples : [canonicalAnswer]
            };
        });
        
        // Sort by count (highest first)
        voteGroups.sort((a, b) => b.count - a.count);
        
        res.json({ voteGroups });
        
    } catch (error) {
        console.error('Error getting vote distribution:', error);
        res.status(500).json({ error: 'Failed to get vote distribution' });
    }
});

module.exports = router;