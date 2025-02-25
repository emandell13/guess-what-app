const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const adminAuth = require('../middleware/adminAuth');
const voteService = require('../services/voteService');

// Apply auth middleware to all admin routes
router.use(adminAuth);

// Get all questions
router.get('/questions', async (req, res) => {
    try {
        const { data: questions, error } = await supabase
            .from('questions')
            .select('*')
            .order('active_date', { ascending: false });

        if (error) throw error;
        res.json({ questions });
    } catch (error) {
        console.error('Error fetching questions:', error);
        res.status(500).json({ error: 'Failed to fetch questions' });
    }
});

// Create a new question
router.post('/questions', async (req, res) => {
    try {
        const { question_text, active_date } = req.body;
        
        const { data, error } = await supabase
            .from('questions')
            .insert([{ 
                question_text, 
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

// Tally votes and set top answers for a question
router.post('/tally/:questionId', async (req, res) => {
    try {
        const { questionId } = req.params;
        
        // Use the new service function
        const result = await voteService.tallyVotesForQuestion(questionId);
        
        if (result.success) {
            res.json({ 
                message: 'Votes tallied successfully', 
                topAnswers: result.data 
            });
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('Error tallying votes:', error);
        res.status(500).json({ error: 'Failed to tally votes' });
    }
});

// Get a single question with its top answers
router.get('/questions/:id', async (req, res) => {
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
        
        // Get vote count
        const { count: voteCount, error: countError } = await supabase
            .from('votes')
            .select('*', { count: 'exact', head: true })
            .eq('question_id', id);
            
        if (countError) throw countError;
        
        res.json({ 
            question, 
            topAnswers: topAnswers || [],
            voteCount: voteCount || 0
        });
    } catch (error) {
        console.error('Error fetching question:', error);
        res.status(500).json({ error: 'Failed to fetch question' });
    }
});

// Update a question
router.put('/questions/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { question_text, active_date, voting_complete } = req.body;
        
        const { data, error } = await supabase
            .from('questions')
            .update({ 
                question_text, 
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
router.delete('/questions/:id', async (req, res) => {
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