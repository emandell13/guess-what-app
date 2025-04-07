const supabase = require('../config/supabase');
const { getTodayDate } = require('../utils/dateUtils');
const {isSemanticMatch} = require('../utils/semanticUtils');
const { isFuzzyMatch, normalizeText } = require('../utils/textUtils');

async function getCurrentQuestion() {
    const todayDate = getTodayDate();
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

    // First check: Look for exact matches in the votes table that have a matched_answer_id
    // This gives us the fastest response for previously seen answers
    if (normalizedGuess) {
        const { data: matchingVotes, error: votesError } = await supabase
            .from('votes')
            .select('matched_answer_id')
            .eq('question_id', question.id)
            .ilike('response', normalizedGuess)
            .not('matched_answer_id', 'is', null);

        if (!votesError && matchingVotes && matchingVotes.length > 0) {
            // Check if the vote maps to any of our top 5 answers
            const matchedAnswerId = matchingVotes[0].matched_answer_id;
            matchedAnswer = top5Answers.find(answer => answer.id === matchedAnswerId);
            
            if (matchedAnswer) {
                console.log(`Found exact match for "${guess}" from votes table`);
            }
        }
    }

    // Second check: Use semantic matching if first check didn't find a match
    if (!matchedAnswer) {
        console.log(`No exact match found for "${guess}", performing semantic matching...`);
        
        // Check each top 5 answer with semantic matching
        for (const answer of top5Answers) {
            // Use the question context to improve matching accuracy
            const isMatch = await isSemanticMatch(normalizedGuess, answer.answer, {
                threshold: 0.75, // Adjust threshold as needed
                questionContext: question.question_text
            });
            
            if (isMatch) {
                matchedAnswer = answer;
                console.log(`Semantic match found: "${guess}" matches "${answer.answer}"`);
                break;
            }
        }
    }

    const top10Total = top10Answers.reduce((sum, answer) => sum + answer.vote_count, 0);
    const score = matchedAnswer ? Math.round((matchedAnswer.vote_count / top10Total) * 100) : 0;

    // Record the guess in the database if we have an identifier
    if (userId || visitorId) {
        try {
            // First, find the game progress record or create one
            let gameProgressId = null;
            
            // Build query to find existing progress
            let query = supabase
                .from('game_progress')
                .select('id')
                .eq('question_id', question.id);
                
            if (userId) {
                query = query.eq('user_id', userId);
            } else if (visitorId) {
                query = query.eq('visitor_id', visitorId);
            }
            
            // Try to get existing progress
            const { data: existingProgress, error: progressError } = await query.single();
            
            if (!progressError && existingProgress) {
                gameProgressId = existingProgress.id;
            } else {
                // Create a new progress record
                const progressData = {
                    question_id: question.id,
                    final_score: matchedAnswer ? score : 0,
                    strikes: matchedAnswer ? 0 : 1,
                    completed: false
                };
                
                if (userId) {
                    progressData.user_id = userId;
                }
                
                if (visitorId) {
                    progressData.visitor_id = visitorId;
                }
                
                const { data: newProgress, error: createError } = await supabase
                    .from('game_progress')
                    .insert([progressData])
                    .select('id')
                    .single();
                    
                if (!createError && newProgress) {
                    gameProgressId = newProgress.id;
                } else {
                    console.error('Error creating game progress:', createError);
                }
            }

            // Now create the guess record with the game progress ID
            const guessData = {
                question_id: question.id,
                guess_text: guess,
                is_correct: !!matchedAnswer,
                points_earned: matchedAnswer ? score : 0,
                matched_answer_id: matchedAnswer ? matchedAnswer.id : null,
                game_progress_id: gameProgressId
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
