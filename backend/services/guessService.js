// backend/services/guessService.js (simplified approach)

const supabase = require('../config/supabase');
const { getTodayDate } = require('../utils/dateUtils');
const { normalizeText } = require('../utils/textUtils');
const gameConstants = require('../config/gameConstants');
const { callLLM } = require('./llmService'); 
const { createGuessMatchingPrompt } = require('../services/promptTemplates');

// Create simple in-memory cache for LLM match results
const matchCache = new Map();

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
            
            // Rest of the code remains the same...
            // Record guess, return result, etc.
            return {
                isCorrect: true,
                rank: matchedAnswer.rank,
                voteCount: matchedAnswer.vote_count,
                hint: matchedAnswer.hint, // Include hint in response
                canonicalAnswer: matchedAnswer.answer,
                message: `Correct! This was answer #${matchedAnswer.rank}`,
                answerId: matchedAnswer.id
            };
        }
    }
    
    // Step 1: Check for exact database matches first (fastest, no API cost)
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

    // Step 2: If no database match, use LLM matching
    if (!matchedAnswer) {
        console.log(`No exact match found for "${guess}", trying LLM matching...`);
        matchedAnswer = await checkGuessWithLLM(guess, top5Answers, question.question_text);
    }

    // Record the guess in the database if we have an identifier
    if (userId || visitorId) {
        // [Existing database recording logic unchanged]
        try {
            // First, find the game progress record or create one
            // ...existing code...
        } catch (error) {
            console.error('Exception when recording guess:', error);
            // Don't throw here - we still want to return the guess result
        }
    }

    return {
        isCorrect: !!matchedAnswer,
        rank: matchedAnswer?.rank || null,
        voteCount: matchedAnswer?.vote_count || 0,
        hint: matchedAnswer?.hint || null, // Include hint in response
        canonicalAnswer: matchedAnswer?.answer || null,
        message: matchedAnswer ? `Correct! This was answer #${matchedAnswer.rank}` : 'Try again!',
        answerId: matchedAnswer?.id || null
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
};