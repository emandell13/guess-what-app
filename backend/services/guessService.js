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

async function checkGuess(guess) {
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

    return {
        isCorrect: !!matchedAnswer,
        rank: matchedAnswer?.rank || null,
        points: score,
        rawVotes: matchedAnswer?.vote_count || 0,
        canonicalAnswer: matchedAnswer?.answer || null,
        message: matchedAnswer ? `Correct! This was answer #${matchedAnswer.rank}` : 'Try again!',
    };
}

module.exports = {
    getCurrentQuestion,
    getTopAnswers,
    checkGuess
};
