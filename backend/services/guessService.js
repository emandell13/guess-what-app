const supabase = require('../config/supabase');

async function getCurrentQuestion() {
    // Get today's date in ET
    const et = new Date().toLocaleString("en-US", {timeZone: "America/New_York"});
    const etDate = new Date(et);
    const todayDate = etDate.getFullYear() + '-' + 
        String(etDate.getMonth() + 1).padStart(2, '0') + '-' + 
        String(etDate.getDate()).padStart(2, '0');

    const { data: question, error } = await supabase
        .from('questions')
        .select('*')
        .eq('active_date', todayDate)
        .eq('voting_complete', true)
        .single();

    if (error || !question) {
        throw new Error('No question available for guessing');
    }

    return question;
}

async function checkGuess(guess) {
    const question = await getCurrentQuestion();
    
    const { data: topAnswers, error } = await supabase
        .from('top_answers')
        .select('*')
        .eq('question_id', question.id);

    if (error) {
        throw new Error('Failed to fetch answers');
    }

    const normalizedGuess = guess.toLowerCase().trim();
    const matchedAnswer = topAnswers.find(
        answer => answer.answer.toLowerCase().trim() === normalizedGuess
    );

    return {
        isCorrect: !!matchedAnswer,
        rank: matchedAnswer?.rank || null,
        totalAnswers: topAnswers.length
    };
}

module.exports = {
    getCurrentQuestion,
    checkGuess
};