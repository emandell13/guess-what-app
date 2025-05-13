// backend/scripts/dailyUpdate.js

require('dotenv').config();
const supabase = require('../config/supabase');
const { getTodayDate, getTomorrowDate } = require('../utils/dateUtils');
const { normalizeText } = require('../utils/textUtils');
const gameConstants = require('../config/gameConstants');
const { callLLM } = require('../services/llmService');
const { createAnswerGroupingPrompt, createHintGenerationPrompt } = require('../services/promptTemplates');

/**
 * Daily update process that tallies votes for today's question
 * and prepares for tomorrow's question
 * @returns {Promise<Object>} Result of the daily update
 */
async function dailyUpdate() {
  console.log('Starting daily update process...');
  
  try {
    // Get dates in ET timezone using date utilities
    const todayDate = getTodayDate();
    
    // Step 1: Find TODAY's question that was in voting phase yesterday
    // (it should have active_date=TODAY and voting_complete=false)
    await tallyVotesForTodaysQuestion(todayDate);

    // Step 2: Prepare tomorrow's question for voting
    const tomorrowDate = getTomorrowDate();
    await prepareTomorrowsQuestion(tomorrowDate);
    
    console.log('Daily update completed successfully');
    return { success: true };
  } catch (error) {
    console.error('Error in daily update:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Tally votes for today's question and update top answers
 * @param {string} todayDate - Today's date in YYYY-MM-DD format
 */
async function tallyVotesForTodaysQuestion(todayDate) {
  console.log(`Finding question to tally for today (${todayDate})`);
  
  // Find today's active question that needs vote tallying
  const { data: question, error: questionError } = await supabase
    .from('questions')
    .select('*')
    .eq('active_date', todayDate)
    .eq('voting_complete', false)
    .single();
    
  if (questionError) {
    console.error('Error finding question:', questionError);
    return;
  }
    
  if (!question) {
    console.log('No question found that needs tallying for today');
    return;
  }
  
  console.log(`Tallying votes for today's question: ${question.question_text} (ID: ${question.id})`);
  
  // Get all votes for this question
  const { data: votes, error: votesError } = await supabase
    .from('votes')
    .select('*')
    .eq('question_id', question.id);
    
  if (votesError) {
    console.error('Error fetching votes:', votesError);
    await markQuestionComplete(question.id);
    return;
  }
    
  if (!votes || votes.length === 0) {
    console.log('No votes found');
    await markQuestionComplete(question.id);
    return;
  }
  
  console.log(`Found ${votes.length} votes`);
  
  // Extract response text from votes
  const voteTexts = votes.map(vote => vote.response);
  
  // Send ALL votes directly to the LLM
  const groupedVotes = await groupAllVotesWithLLM(voteTexts, question.question_text);
  
  if (!groupedVotes) {
    console.log('LLM grouping failed, marking question as complete without grouping');
    await markQuestionComplete(question.id);
    return;
  }
  
  // Store excluded answers for logging
  let excludedAnswers = [];
  if (groupedVotes.EXCLUDED_ANSWERS) {
    const excludedIndices = groupedVotes.EXCLUDED_ANSWERS;
    excludedAnswers = excludedIndices.map(idx => voteTexts[idx - 1]);
    console.log(`Excluding ${excludedIndices.length} inappropriate answers:`, excludedAnswers);
    delete groupedVotes.EXCLUDED_ANSWERS;
  }
  
  // Convert to array and sort by count
  const sortedVotes = Object.entries(groupedVotes)
    .map(([canonicalAnswer, indices]) => ({
      answer: canonicalAnswer,
      count: indices.length,
      voteIndices: indices
    }))
    .sort((a, b) => b.count - a.count);
  
  // Validate total count
  const totalGroupedVotes = sortedVotes.reduce((sum, group) => sum + group.count, 0) + 
                           (groupedVotes.EXCLUDED_ANSWERS?.length || 0);
  
  if (totalGroupedVotes !== votes.length) {
    console.warn(`Vote count mismatch: ${totalGroupedVotes} votes after grouping vs. ${votes.length} original votes`);
  } else {
    console.log(`Vote count validated: ${totalGroupedVotes} votes successfully processed`);
  }
  
  // Take top answers
  const topAnswers = sortedVotes.slice(0, gameConstants.TOP_ANSWER_COUNT);
  console.log('Top answers to insert:', topAnswers.slice(0, gameConstants.TOP_ANSWER_COUNT));
  
  // Generate hints for top answers
  console.log('Generating hints for top answers...');
  for (const answerData of topAnswers) {
    try {
      const hint = await generateHintForAnswer(answerData.answer, question.question_text);
      answerData.hint = hint;
      console.log(`Generated hint for "${answerData.answer}": "${hint}"`);
    } catch (error) {
      console.error(`Error generating hint for "${answerData.answer}":`, error);
      // Set a default hint if generation fails
      answerData.hint = "Think about common responses to this question!";
    }
  }
  
  // Clear any existing top answers first
  await clearExistingTopAnswers(question.id);
  
  // Insert top answers with hints
  const insertedAnswers = await insertTopAnswers(question.id, topAnswers);
  
  // Update votes with matched_answer_id
  await updateVotesWithLLMGroups(votes, voteTexts, groupedVotes, insertedAnswers);
  
  // Mark question as voting complete
  await markQuestionComplete(question.id);
  
  console.log(`Tallied ${votes.length} votes into ${topAnswers.length} top answers with hints`);
}

/**
 * Generates a hint for a top answer
 * @param {string} answer - The canonical answer
 * @param {string} questionText - The question text
 * @returns {Promise<string>} - The generated hint
 */
async function generateHintForAnswer(answer, questionText) {
  try {
    const prompt = createHintGenerationPrompt(answer, questionText);
    const result = await callLLM(prompt, { maxTokens: 100, skipCache: true });
    
    // Clean up the result (remove quotation marks if present)
    const cleanedHint = result.replace(/^["']|["']$/g, '').trim();
    
    return cleanedHint;
  } catch (error) {
    console.error(`Error generating hint for "${answer}":`, error);
    throw error;
  }
}

/**
 * Group all votes using LLM with batch processing for large vote sets
 * @param {Array<string>} votes - List of all vote texts
 * @param {string} questionText - The question text for context
 * @returns {Object} - Grouped votes with canonical answers as keys and vote indices as values
 */
async function groupAllVotesWithLLM(votes, questionText) {
  try {
    console.log(`Grouping ${votes.length} votes with LLM`);
    
    // For large numbers of votes, we need to batch them
    const BATCH_SIZE = 100; // Adjust based on token limits and performance
    const batches = [];
    
    // Create batches of votes
    for (let i = 0; i < votes.length; i += BATCH_SIZE) {
      batches.push(votes.slice(i, Math.min(i + BATCH_SIZE, votes.length)));
    }
    
    console.log(`Processing votes in ${batches.length} batches`);
    
    // Process each batch
    const batchResults = [];
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const startIndex = i * BATCH_SIZE;
      console.log(`Processing batch ${i+1}/${batches.length} with ${batch.length} votes (indices ${startIndex+1}-${startIndex+batch.length})`);
      
      // Create the prompt
      const prompt = createAnswerGroupingPrompt(batch, questionText);
      
      // Call the LLM with error handling
      let result;
      try {
        result = await callLLM(prompt, { maxTokens: 4000 });
      } catch (apiError) {
        console.error(`Error calling LLM for batch ${i+1}:`, apiError);
        continue; // Skip this batch if the API call fails
      }
      
      // Parse the result with error handling
      try {
        // Extract JSON content in case there's any surrounding text
        const jsonMatch = result.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? jsonMatch[0] : result;
        
        const groupedBatch = JSON.parse(jsonStr);
        batchResults.push({
          groupedBatch,
          startIndex
        });
      } catch (parseError) {
        console.error(`Error parsing batch ${i+1} result:`, parseError);
        console.error('Raw LLM output:', result);
        continue; // Skip this batch if parsing fails
      }
    }
    
    // If all batches failed, return null
    if (batchResults.length === 0) {
      console.error('All batches failed to process');
      return null;
    }
    
    // Merge batch results
    const mergedGroups = {};
    const excludedAnswers = [];
    
    // Process each batch result
    batchResults.forEach(({ groupedBatch, startIndex }) => {
      // Handle excluded answers
      if (groupedBatch.EXCLUDED_ANSWERS) {
        // Adjust indices to global vote array
        const globalExcludedIndices = groupedBatch.EXCLUDED_ANSWERS.map(idx => startIndex + idx);
        excludedAnswers.push(...globalExcludedIndices);
      }
      
      // Process each group in the batch
      Object.entries(groupedBatch).forEach(([canonicalAnswer, indices]) => {
        // Skip the EXCLUDED_ANSWERS key
        if (canonicalAnswer === 'EXCLUDED_ANSWERS') {
          return;
        }
        
        // Adjust indices to global vote array
        const globalIndices = indices.map(idx => startIndex + idx);
        
        // Add to merged groups
        if (mergedGroups[canonicalAnswer]) {
          mergedGroups[canonicalAnswer].push(...globalIndices);
        } else {
          mergedGroups[canonicalAnswer] = globalIndices;
        }
      });
    });
    
    // Add excluded answers to final result
    if (excludedAnswers.length > 0) {
      mergedGroups.EXCLUDED_ANSWERS = excludedAnswers;
    }
    
    return mergedGroups;
  } catch (error) {
    console.error('Error grouping votes with LLM:', error);
    return null;
  }
}

/**
 * Mark a question as completed (voting is finished)
 * @param {number} questionId - The question ID
 */
async function markQuestionComplete(questionId) {
  const { error } = await supabase
    .from('questions')
    .update({ voting_complete: true })
    .eq('id', questionId);
    
  if (error) {
    console.error('Error marking question as complete:', error);
  } else {
    console.log('Question marked as complete');
  }
}

/**
 * Clear existing top answers for a question
 * @param {number} questionId - The question ID
 */
async function clearExistingTopAnswers(questionId) {
  const { error } = await supabase
    .from('top_answers')
    .delete()
    .eq('question_id', questionId);
    
  if (error) {
    console.error('Error clearing existing top answers:', error);
  }
}

/**
 * Insert top answers for a question
 * @param {number} questionId - The question ID
 * @param {Array} topAnswers - Array of top answers to insert
 * @returns {Array} Array of inserted answers
 */
async function insertTopAnswers(questionId, topAnswers) {
  const insertedAnswers = [];
  
  for (let i = 0; i < topAnswers.length; i++) {
    const { answer, count, hint } = topAnswers[i];
    const rank = i + 1;
    
    console.log(`Inserting answer #${rank}: "${answer}" with ${count} votes and hint: "${hint}"`);
    
    const { data, error } = await supabase
      .from('top_answers')
      .insert([{
        question_id: questionId,
        answer,
        vote_count: count,
        rank,
        hint
      }])
      .select();
      
    if (error) {
      console.error(`Error inserting answer #${rank}:`, error);
    } else if (data && data.length > 0) {
      console.log(`Answer #${rank} inserted:`, data[0]);
      insertedAnswers.push(data[0]);
    }
  }
  
  return insertedAnswers;
}

/**
 * Update votes with matched answer IDs
 * @param {Array} votes - Array of vote objects
 * @param {Array} voteTexts - Array of vote text strings
 * @param {Object} groupedVotes - Grouped votes from LLM
 * @param {Array} insertedAnswers - Inserted top answers
 */
async function updateVotesWithLLMGroups(votes, voteTexts, groupedVotes, insertedAnswers) {
  console.log('Updating votes with matched answer IDs...');
  
  // Create a mapping of canonical answers to top_answer IDs
  const answerToIdMap = {};
  insertedAnswers.forEach(answer => {
    answerToIdMap[answer.answer] = answer.id;
  });
  
  // Process each vote
  for (let i = 0; i < votes.length; i++) {
    const vote = votes[i];
    // LLM returns 1-based indices, so add 1 to our 0-based index
    const voteIndex = i + 1;
    
    // Find which group this vote belongs to
    let matchedCanonicalAnswer = null;
    for (const [canonicalAnswer, indices] of Object.entries(groupedVotes)) {
      if (canonicalAnswer === 'EXCLUDED_ANSWERS') continue;
      
      if (indices.includes(voteIndex)) {
        matchedCanonicalAnswer = canonicalAnswer;
        break;
      }
    }
    
    // Skip if no canonical answer or it's not in our top answers
    if (!matchedCanonicalAnswer || !answerToIdMap[matchedCanonicalAnswer]) {
      continue;
    }
    
    // Update the vote record
    const matchedAnswerId = answerToIdMap[matchedCanonicalAnswer];
    const { error } = await supabase
      .from('votes')
      .update({ matched_answer_id: matchedAnswerId })
      .eq('id', vote.id);
      
    if (error) {
      console.error(`Error updating vote ${vote.id}:`, error);
    }
  }
}

/**
 * Prepares tomorrow's question for voting if needed
 * @param {string} tomorrowDate - Tomorrow's date in YYYY-MM-DD format
 */
async function prepareTomorrowsQuestion(tomorrowDate) {
  console.log(`Checking for tomorrow's question (${tomorrowDate})`);
  
  // Check if tomorrow's question exists
  const { data: existingTomorrow, error: checkError } = await supabase
    .from('questions')
    .select('*')
    .eq('active_date', tomorrowDate)
    .single();
    
  if (checkError && checkError.code !== 'PGRST116') { // Not found is ok
    console.error('Error checking for tomorrow\'s question:', checkError);
  }
    
  if (existingTomorrow) {
    console.log(`Tomorrow's question already exists: ${existingTomorrow.question_text}`);
    return;
  }
  
  console.log('No question found for tomorrow');
}

module.exports = dailyUpdate;