const supabase = require('../config/supabase');

async function submitVote(response) {
    // Get tomorrow's question (where voting is still open)
    const { data: question, error: questionError } = await supabase
        .from('questions')
        .select('id')
        .eq('voting_complete', false)
        .single();
        
    if (questionError || !question) {
        throw new Error('No active question available for voting');
    }

    // Record the vote
    const { data, error } = await supabase
        .from('votes')
        .insert([
            { 
                question_id: question.id,
                response: response.toLowerCase().trim() // Store in consistent format
            }
        ]);

    if (error) {
        throw new Error('Failed to record vote');
    }

    return data;
}

async function getCurrentQuestion() {
    const { data: question, error } = await supabase
        .from('questions')
        .select('*')
        .eq('voting_complete', false)
        .single();

    if (error || !question) {
        throw new Error('No active question available');
    }

    return question;
}

module.exports = {
    submitVote,
    getCurrentQuestion
};
