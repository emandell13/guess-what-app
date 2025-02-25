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

async function tallyVotesForQuestion(questionId) {
    try {
        // 1. Get all votes for the question
        const { data: votes, error: votesError } = await supabase
            .from('votes')
            .select('response')
            .eq('question_id', questionId);
        
        if (votesError) {
            console.error('Error fetching votes:', votesError);
            return {
                success: false,
                error: 'Failed to fetch votes'
            };
        }
        
        // 2. Count occurrences of each answer
        const answerCounts = {};
        votes.forEach(vote => {
            // Make sure we're using the correct field name from your schema
            const answer = vote.response.trim().toLowerCase();
            answerCounts[answer] = (answerCounts[answer] || 0) + 1;
        });
        
        // 3. Convert to array and sort by count (descending)
        const sortedAnswers = Object.entries(answerCounts)
            .map(([text, count]) => ({ text, count }))
            .sort((a, b) => b.count - a.count);
        
        // 4. Take top 5 answers
        const topAnswers = sortedAnswers.slice(0, 5);
        
        // 5. Delete any existing top answers for this question
        const { error: deleteError } = await supabase
            .from('top_answers')
            .delete()
            .eq('question_id', questionId);
            
        if (deleteError) {
            console.error('Error deleting existing top answers:', deleteError);
            return {
                success: false,
                error: 'Failed to clear existing top answers'
            };
        }
        
        // 6. Save to top_answers table
        const topAnswersData = topAnswers.map((answer, index) => ({
            question_id: questionId,
            answer_text: answer.text,
            answer_count: answer.count,
            rank: index + 1
        }));
        
        const { error: insertError } = await supabase
            .from('top_answers')
            .insert(topAnswersData);
            
        if (insertError) {
            console.error('Error inserting top answers:', insertError);
            return {
                success: false,
                error: 'Failed to save top answers'
            };
        }
        
        // 7. Update question as voting_complete
        const { error: updateError } = await supabase
            .from('questions')
            .update({ voting_complete: true })
            .eq('id', questionId);
            
        if (updateError) {
            console.error('Error updating question status:', updateError);
            return {
                success: false,
                error: 'Failed to mark question as complete'
            };
        }
        
        return {
            success: true,
            data: topAnswers
        };
    } catch (error) {
        console.error('Error tallying votes:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

async function getTopAnswersForQuestion(questionId) {
    try {
        const { data, error } = await supabase
            .from('top_answers')
            .select('*')
            .eq('question_id', questionId)
            .order('rank', { ascending: true });
        
        if (error) {
            console.error('Error fetching top answers:', error);
            return {
                success: false,
                error: 'Failed to fetch top answers'
            };
        }
        
        return {
            success: true,
            data: data
        };
    } catch (error) {
        console.error('Error getting top answers:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

async function getTopAnswersForToday() {
    try {
        // Get today's date in ET timezone
        const et = new Date().toLocaleString("en-US", {timeZone: "America/New_York"});
        const etDate = new Date(et);
        
        // Format today's date in YYYY-MM-DD
        const todayDate = etDate.getFullYear() + '-' + 
            String(etDate.getMonth() + 1).padStart(2, '0') + '-' + 
            String(etDate.getDate()).padStart(2, '0');
        
        // Get today's active question
        const { data: question, error: questionError } = await supabase
            .from('questions')
            .select('id')
            .eq('active_date', todayDate)
            .single();
        
        if (questionError || !question) {
            return {
                success: false,
                error: 'No active question found for today'
            };
        }
        
        // Get top answers for this question
        return await getTopAnswersForQuestion(question.id);
    } catch (error) {
        console.error('Error getting today\'s top answers:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

module.exports = {
    submitVote,
    getCurrentQuestion,
    tallyVotesForQuestion,
    getTopAnswersForQuestion,
    getTopAnswersForToday
};