// backend/services/guessService.js (updated sections for streak integration)

const supabase = require('../config/supabase');
const { getTodayDate } = require('../utils/dateUtils');
const { normalizeText } = require('../utils/textUtils');
const gameConstants = require('../config/gameConstants');
const { callLLM } = require('./llmService'); 
const { createGuessMatchingPrompt } = require('../services/promptTemplates');
const gameService = require('./gameService'); // Import gameService for streak updates

// ... existing functions (getCurrentQuestion, getTopAnswers, etc.) remain the same ...

async function getCurrentQuestion() {
    // Existing implementation unchanged
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

async function getTopAnswers(questionId, limit = gameConstants.DEFAULT_ANSWER_COUNT) {
    // Updated to include hint field
    const { data: answers, error } = await supabase
        .from('top_answers')
        .select('*')
        .eq('question_id', questionId)
        .lte('rank', limit)
        .order('rank', { ascending: true });

    if (error) throw new Error('Failed to fetch answers');
    return answers;
}

/**
 * Get a hint for a specific answer
 * @param {number} answerId - The ID of the answer
 * @returns {Promise<string|null>} - The hint text or null if not found
 */
async function getAnswerHint(answerId) {
    try {
        const { data, error } = await supabase
            .from('top_answers')
            .select('hint')
            .eq('id', answerId)
            .single();
            
        if (error) throw error;
        return data?.hint || null;
    } catch (error) {
        console.error('Error fetching hint:', error);
        return null;
    }
}

/**
 * Check if a guess matches a top answer using LLM
 * @param {string} guess - The user's guess
 * @param {Array<Object>} topAnswers - Possible matching answers
 * @param {string} questionText - The question context 
 * @returns {Object|null} - Matching answer or null
 */
async function checkGuessWithLLM(guess, topAnswers, questionText) {
    try {
        // Normalize guess for consistent matching
        const normalizedGuess = normalizeText(guess);
        
        // Create cache key using normalized guess and question ID
        const cacheKey = `${questionText}|${normalizedGuess}`;
        
        // Check cache first
        const matchCache = new Map(); // You might want to make this module-level
        if (matchCache.has(cacheKey)) {
            const cachedResult = matchCache.get(cacheKey);
            console.log(`Match cache hit: "${normalizedGuess}" -> ${cachedResult ? cachedResult.answer : 'NO_MATCH'}`);
            return cachedResult;
        }
        
        console.log(`Checking guess with LLM: "${normalizedGuess}"`);
        
        // Extract answer texts for the prompt
        const answerTexts = topAnswers.map(answer => answer.answer);
        
        // Create the prompt
        const prompt = createGuessMatchingPrompt(normalizedGuess, answerTexts, questionText);
        
        // Call the LLM
        const result = await callLLM(prompt);
        
        // Find the matching answer object if the LLM found a match
        let matchedAnswer = null;
        if (result !== "NO_MATCH") {
            matchedAnswer = topAnswers.find(answer => answer.answer === result);
        }
        
        // Cache the result
        matchCache.set(cacheKey, matchedAnswer);
        
        return matchedAnswer;
    } catch (error) {
        console.error('Error in LLM guess checking:', error);
        return null; // Return null on error
    }
}

async function checkGuess(guess, userId = null, visitorId = null) {
    const question = await getCurrentQuestion();
    const top5Answers = await getTopAnswers(question.id, 5);
    
    let matchedAnswer = null;
    const normalizedGuess = normalizeText(guess);
    
    // Step 0: Direct comparison with top answers (simplest, fastest)
    if (normalizedGuess) {
        console.log(`Checking direct match against top answers for: "${normalizedGuess}"`);
        
        // Direct case-insensitive comparison with top answers
        matchedAnswer = top5Answers.find(answer => 
            normalizeText(answer.answer) === normalizedGuess
        );
        
        if (matchedAnswer) {
            console.log(`Direct match found: "${normalizedGuess}" matches top answer "${matchedAnswer.answer}"`);
        }
    }
    
    // Step 1: Check for exact database matches first (fastest, no API cost)
    if (!matchedAnswer && normalizedGuess) {
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

    // Step 2: If no database match, use LLM matching
    if (!matchedAnswer) {
        console.log(`No exact match found for "${guess}", trying LLM matching...`);
        matchedAnswer = await checkGuessWithLLM(guess, top5Answers, question.question_text);
    }

    // Record the guess in the database if we have an identifier
    let gameCompletedThisGuess = false;
    
    if (userId || visitorId) {
        try {
            // First, find the game progress record or create one
            let query = supabase
                .from('game_progress')
                .select('id, total_guesses, completed, gave_up')
                .eq('question_id', question.id);
                
            if (userId) {
                query = query.eq('user_id', userId);
            } else if (visitorId) {
                query = query.eq('visitor_id', visitorId);
            }
            
            const { data: progressData, error: progressError } = await query.single();
            
            let gameProgress;
            
            if (progressError || !progressData) {
                // Create new game progress record
                const newProgressData = {
                    question_id: question.id,
                    total_guesses: 1,
                    strikes: matchedAnswer ? 0 : 1,
                    completed: false,
                    gave_up: false
                };
                
                if (userId) newProgressData.user_id = userId;
                if (visitorId) newProgressData.visitor_id = visitorId;
                
                const { data: newProgress, error: insertError } = await supabase
                    .from('game_progress')
                    .insert([newProgressData])
                    .select()
                    .single();
                    
                if (insertError) {
                    console.error('Error creating game progress:', insertError);
                } else {
                    gameProgress = newProgress;
                }
            } else {
                // Update existing game progress
                const newTotalGuesses = (progressData.total_guesses || 0) + 1;
                const newStrikes = matchedAnswer ? 
                    progressData.strikes : 
                    (progressData.strikes || 0) + 1;
                
                const { data: updatedProgress, error: updateError } = await supabase
                    .from('game_progress')
                    .update({
                        total_guesses: newTotalGuesses,
                        strikes: newStrikes
                    })
                    .eq('id', progressData.id)
                    .select()
                    .single();
                    
                if (updateError) {
                    console.error('Error updating game progress:', updateError);
                } else {
                    gameProgress = updatedProgress;
                }
            }
            
            // Check if game is now complete (found all 5 answers)
            if (gameProgress && matchedAnswer) {
                // Count how many unique answers have been found
                const { data: guessData, error: guessError } = await supabase
                    .from('guesses')
                    .select('matched_answer_id')
                    .eq('question_id', question.id)
                    .not('matched_answer_id', 'is', null);
                    
                if (userId) {
                    guessData && guessData.filter(g => g.user_id === userId);
                } else if (visitorId) {
                    guessData && guessData.filter(g => g.visitor_id === visitorId);
                }
                
                const uniqueAnswersFound = new Set(
                    guessData ? guessData.map(g => g.matched_answer_id) : []
                );
                uniqueAnswersFound.add(matchedAnswer.id); // Add this answer
                
                if (uniqueAnswersFound.size >= top5Answers.length) {
                    // Game is complete! Update progress and process streak
                    await supabase
                        .from('game_progress')
                        .update({ completed: true })
                        .eq('id', gameProgress.id);
                    
                    gameCompletedThisGuess = true;
                    
                    // Update streak - this is a win (only for authenticated users)
                    if (userId) {
                        await gameService.updateStreakForGameCompletion(
                            userId, 
                            question.active_date, 
                            true // isWin = true
                        );
                    }
                }
            }
            
            // Record the individual guess
            const guessData = {
                question_id: question.id,
                guess_text: guess,
                matched_answer_id: matchedAnswer ? matchedAnswer.id : null,
                is_correct: !!matchedAnswer
            };
            
            if (userId) guessData.user_id = userId;
            if (visitorId) guessData.visitor_id = visitorId;
            
            await supabase
                .from('guesses')
                .insert([guessData]);
                
        } catch (error) {
            console.error('Exception when recording guess:', error);
            // Don't throw here - we still want to return the guess result
        }
    }

    return {
        isCorrect: !!matchedAnswer,
        rank: matchedAnswer?.rank || null,
        voteCount: matchedAnswer?.vote_count || 0,
        hint: matchedAnswer?.hint || null,
        canonicalAnswer: matchedAnswer?.answer || null,
        message: matchedAnswer ? `Correct! This was answer #${matchedAnswer.rank}` : 'Try again!',
        answerId: matchedAnswer?.id || null,
        gameCompleted: gameCompletedThisGuess
    };
}

/**
 * Get hints for all top answers for a question
 * @param {number} questionId - The question ID
 * @returns {Promise<Array>} - Array of hints with answer IDs
 */
async function getHintsForQuestion(questionId) {
    try {
        const { data, error } = await supabase
            .from('top_answers')
            .select('id, rank, hint')
            .eq('question_id', questionId)
            .order('rank');
            
        if (error) throw error;
        
        return data;
    } catch (error) {
        console.error('Error fetching hints:', error);
        return [];
    }
}

module.exports = {
    getCurrentQuestion,
    getTopAnswers,
    getAnswerHint,
    checkGuess,
    getHintsForQuestion
}