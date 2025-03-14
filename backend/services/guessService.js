const supabase = require('../config/supabase');
const { getTodayDateET } = require('../utils/dateUtils');
const { isFuzzyMatch, normalizeText } = require('../utils/textUtils');

async function getCurrentQuestion() {
    const todayDate = getTodayDateET();
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

async function getTopAnswers(questionId, limit = 10) {
    const { data: answers, error } = await supabase
        .from('top_answers')
        .select('*')
        .eq('question_id', questionId)
        .lte('rank', limit)
        .order('rank', { ascending: true });

    if (error) throw new Error('Failed to fetch answers');
    return answers;
}

async function checkGuess(guess, userId = null, visitorId = null) {
    const question = await getCurrentQuestion();
    const top10Answers = await getTopAnswers(question.id, 10);
    const top5Answers = top10Answers.filter(answer => answer.rank <= 5);
    
    const normalizedGuess = normalizeText(guess);
    let matchedAnswer = null;

    for (const answer of top5Answers) {
        if (isFuzzyMatch(normalizedGuess, answer.answer)) {
            matchedAnswer = answer;
            break;
        }
    }

    const top10Total = top10Answers.reduce((sum, answer) => sum + answer.vote_count, 0);
    const score = matchedAnswer ? Math.round((matchedAnswer.vote_count / top10Total) * 100) : 0;

    // Record the guess in the database if we have an identifier
    if (userId || visitorId) {
        try {
            const guessData = {
                question_id: question.id,
                guess_text: guess,
                is_correct: !!matchedAnswer,
                points_earned: matchedAnswer ? score : 0,
                matched_answer_id: matchedAnswer ? matchedAnswer.id : null
            };

            if (userId) {
                guessData.user_id = userId;
            }
            
            if (visitorId) {
                guessData.visitor_id = visitorId;
            }

            console.log("Recording guess with data:", guessData);

            const { error } = await supabase
                .from('guesses')
                .insert([guessData]);

            if (error) {
                console.error('Error recording guess:', error);
            }
        } catch (error) {
            console.error('Exception when recording guess:', error);
            // Don't throw here - we still want to return the guess result
        }
    }

    return {
        isCorrect: !!matchedAnswer,
        rank: matchedAnswer?.rank || null,
        points: score,
        rawVotes: matchedAnswer?.vote_count || 0,
        canonicalAnswer: matchedAnswer?.answer || null,
        message: matchedAnswer ? `Correct! This was answer #${matchedAnswer.rank}` : 'Try again!',
        answerId: matchedAnswer?.id || null
    };
}

module.exports = {
    getCurrentQuestion,
    getTopAnswers,
    checkGuess
};
