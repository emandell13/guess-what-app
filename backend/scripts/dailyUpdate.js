// backend/scripts/dailyUpdate.js

require('dotenv').config();
const supabase = require('../config/supabase');
const { getTodayDate, getTomorrowDate } = require('../utils/dateUtils');
const { normalizeText } = require('../utils/textUtils');
const gameConstants = require('../config/gameConstants');
const { callLLM } = require('../services/llmService');
const { createAnswerGroupingPrompt, createHintGenerationPrompt, createHintRatingPrompt, createQuipPrompt } = require('../services/promptTemplates');
const { replenishPipeline, promoteNextCandidate } = require('../services/contentEngine');

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

    // Step 1: Tally today's question (was in voting phase yesterday).
    await tallyVotesForTodaysQuestion(todayDate);

    // Step 2: Replenish the candidate pool so promotion has options.
    // Doing this before promotion guarantees liveness even from a cold start.
    let replenishResult = null;
    try {
      replenishResult = await replenishPipeline();
      console.log(`Replenished pool with ${replenishResult.generated} new candidates`);
    } catch (err) {
      console.error('Candidate pool replenishment failed (continuing):', err);
    }

    // Step 3: Promote the top-picked candidate to tomorrow's scheduled
    // question (sets active_date, seeds answers). Idempotent.
    const tomorrowDate = getTomorrowDate();
    let promotionResult = null;
    try {
      promotionResult = await promoteNextCandidate(tomorrowDate);
    } catch (err) {
      console.error('Candidate promotion failed:', err);
    }

    console.log('Daily update completed successfully');
    return {
      success: true,
      replenish: replenishResult,
      promotion: promotionResult
    };
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
  
  // Generate hints for top answers in a single batch call
  console.log('Generating hints for top answers...');
  const hints = await generateHintsForAnswers(
    topAnswers.map(a => a.answer),
    question.question_text
  );
  topAnswers.forEach((answerData, i) => {
    answerData.hint = hints[i] || 'Think about common responses to this question!';
    console.log(`Hint for "${answerData.answer}": "${answerData.hint}"`);
  });
  
  // Clear any existing top answers first
  await clearExistingTopAnswers(question.id);

  // Insert top answers with hints
  const insertedAnswers = await insertTopAnswers(question.id, topAnswers);

  // Update votes with matched_answer_id
  await updateVotesWithLLMGroups(votes, voteTexts, groupedVotes, insertedAnswers);

  // Generate the host quip tied to one of the top 5 (Claude picks the funniest
  // comedy target — doesn't have to be rank 1). Non-fatal; a null result just
  // means no bubble fires for this question.
  await generateAndSaveQuip(question.id, question.question_text, topAnswers);

  // Mark question as voting complete
  await markQuestionComplete(question.id);
  
  console.log(`Tallied ${votes.length} votes into ${topAnswers.length} top answers with hints`);
}

const HINT_CANDIDATES_PER_ANSWER = 3;
// Hints are a creative task — worth the extra cost over the default model.
// Generation is once per question per day, so a few pennies.
const HINT_MODEL = 'claude-opus-4-7';

/**
 * Ask Claude (Sonnet) to pick 2-3 of the top-5 answers as comedy targets and
 * write one host-voice line for each, then save to questions.quips as a JSONB
 * array. The per-day quip call runs on Sonnet for better comedy; the
 * per-guess wrong-guess calls run on the default Haiku.
 *
 * Returns silently on any failure — a missing quips array just means the host
 * bubble won't fire for this question, which is a graceful degrade.
 *
 * @param {number} questionId
 * @param {string} questionText
 * @param {Array<{answer:string, count:number}>} topAnswers - already sorted desc by count
 */
async function generateAndSaveQuip(questionId, questionText, topAnswers) {
  try {
    const topFive = topAnswers.slice(0, 5).map((a, i) => ({
      rank: i + 1,
      answer: a.answer,
      voteCount: a.count
    }));

    if (topFive.length === 0) return;

    const prompt = createQuipPrompt(questionText, topFive);
    const raw = await callLLM(prompt, {
      maxTokens: 500,
      skipCache: true,
      model: 'claude-opus-4-7'
    });

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn(`Quip generator returned no JSON for question ${questionId}:`, raw);
      return;
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const quips = Array.isArray(parsed.quips) ? parsed.quips : [];

    const seenRanks = new Set();
    const validQuips = [];
    for (const q of quips) {
      const targetRank = Number.isInteger(q?.targetRank) ? q.targetRank : null;
      const text = typeof q?.text === 'string' ? q.text.trim() : null;
      if (!targetRank || !text || targetRank < 1 || targetRank > topFive.length) continue;
      if (seenRanks.has(targetRank)) continue;
      seenRanks.add(targetRank);
      validQuips.push({ targetRank, text });
    }

    if (validQuips.length === 0) {
      console.log(`No quip targets for question ${questionId}`);
      return;
    }

    const { error } = await supabase
      .from('questions')
      .update({ quips: validQuips })
      .eq('id', questionId);

    if (error) {
      console.error(`Error saving quips for question ${questionId}:`, error);
    } else {
      console.log(`Saved ${validQuips.length} quips for question ${questionId}:`);
      validQuips.forEach(q => console.log(`  rank=${q.targetRank} "${q.text}"`));
    }
  } catch (error) {
    console.error(`Error generating quips for question ${questionId}:`, error);
  }
}

/**
 * Two-pass hint generation: first call generates N candidates per answer, second
 * call rates them and picks the best. Returns hints aligned to `answers` order.
 * On any failure returns an array of nulls so the caller can fall back per-slot.
 * @param {Array<string>} answers - Top answers in rank order (#1 → #N)
 * @param {string} questionText - The question text
 * @returns {Promise<Array<string|null>>}
 */
async function generateHintsForAnswers(answers, questionText) {
  // --- Pass 1: generate candidates ---
  const genPrompt = createHintGenerationPrompt(questionText, answers, HINT_CANDIDATES_PER_ANSWER);

  let genRaw;
  try {
    genRaw = await callLLM(genPrompt, { maxTokens: 1500, skipCache: true, model: HINT_MODEL });
  } catch (error) {
    console.error('Hint generation LLM call failed:', error);
    return answers.map(() => null);
  }

  let candidateRows;
  try {
    const jsonMatch = genRaw.match(/\[[\s\S]*\]/);
    candidateRows = JSON.parse(jsonMatch ? jsonMatch[0] : genRaw);
  } catch (error) {
    console.error('Failed to parse hint candidate JSON:', error, '\nRaw:', genRaw);
    return answers.map(() => null);
  }

  if (!Array.isArray(candidateRows)) {
    console.error('Hint generation returned non-array:', candidateRows);
    return answers.map(() => null);
  }

  // Normalize candidates and fall back to first candidate per slot if rating fails.
  const normalized = answers.map((answer, i) => {
    const byRank = candidateRows.find(r => Number(r.rank) === i + 1);
    const row = byRank || candidateRows[i];
    const cleaned = Array.isArray(row?.candidates)
      ? row.candidates
          .filter(c => typeof c === 'string')
          .map(c => c.replace(/^["']|["']$/g, '').trim())
          .filter(Boolean)
      : [];
    return { rank: i + 1, answer, candidates: cleaned };
  });

  // --- Pass 2: rate and pick best ---
  const ratePrompt = createHintRatingPrompt(questionText, normalized);

  let rateRaw;
  try {
    rateRaw = await callLLM(ratePrompt, { maxTokens: 800, skipCache: true, model: HINT_MODEL });
  } catch (error) {
    console.error('Hint rating LLM call failed, falling back to first candidate per slot:', error);
    return normalized.map(row => row.candidates[0] || null);
  }

  let verdicts;
  try {
    const jsonMatch = rateRaw.match(/\[[\s\S]*\]/);
    verdicts = JSON.parse(jsonMatch ? jsonMatch[0] : rateRaw);
  } catch (error) {
    console.error('Failed to parse hint rating JSON, falling back:', error, '\nRaw:', rateRaw);
    return normalized.map(row => row.candidates[0] || null);
  }

  if (!Array.isArray(verdicts)) {
    return normalized.map(row => row.candidates[0] || null);
  }

  return normalized.map((row, i) => {
    const verdict = verdicts.find(v => Number(v.rank) === i + 1) || verdicts[i];
    if (verdict && typeof verdict.winner === 'string' && verdict.winner.trim()) {
      return verdict.winner.trim();
    }
    // Fall back to the letter pointer if winner text is missing.
    if (verdict && typeof verdict.best_letter === 'string') {
      const idx = verdict.best_letter.charCodeAt(0) - 97;
      if (row.candidates[idx]) return row.candidates[idx];
    }
    return row.candidates[0] || null;
  });
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
    .update({ voting_complete: true, status: 'completed' })
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

module.exports = dailyUpdate;