const supabase = require('../config/supabase');

async function getCurrentQuestion() {
    // Create date object for Eastern Time
    const et = new Date().toLocaleString("en-US", {timeZone: "America/New_York"});
    const etDate = new Date(et);
    
    // Add one day for tomorrow
    etDate.setDate(etDate.getDate() + 1);

    // Format tomorrow's date in YYYY-MM-DD
    const tomorrowDate = etDate.getFullYear() + '-' + 
        String(etDate.getMonth() + 1).padStart(2, '0') + '-' + 
        String(etDate.getDate()).padStart(2, '0');

    console.log('Debug - Looking for tomorrow (ET):', tomorrowDate);

    const { data: question, error } = await supabase
        .from('questions')
        .select('*')
        .eq('voting_complete', false)
        .eq('active_date', tomorrowDate)
        .single();

    if (error || !question) {
        throw new Error('No active question available');
    }

    return question;
}

async function submitVote(response) {
    const et = new Date().toLocaleString("en-US", {timeZone: "America/New_York"});
    const etDate = new Date(et);
    
    // Add one day for tomorrow
    etDate.setDate(etDate.getDate() + 1);
    
    const tomorrowDate = etDate.getFullYear() + '-' + 
        String(etDate.getMonth() + 1).padStart(2, '0') + '-' + 
        String(etDate.getDate()).padStart(2, '0');

    const { data: question, error: questionError } = await supabase
        .from('questions')
        .select('id')
        .eq('voting_complete', false)
        .eq('active_date', tomorrowDate)
        .single();
    
    if (questionError || !question) {
        throw new Error('No active question available for voting');
    }

    const { data, error } = await supabase
        .from('votes')
        .insert([{ 
            question_id: question.id,
            response: response.toLowerCase().trim()
        }]);

    if (error) {
        throw new Error('Failed to record vote');
    }

    return data;
}

module.exports = {
    submitVote,
    getCurrentQuestion
};