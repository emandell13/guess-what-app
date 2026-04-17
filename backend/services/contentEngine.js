// backend/services/contentEngine.js
//
// Autonomous content pipeline. Keeps ~N days of upcoming questions queued,
// each pre-seeded with synthetic "votes" so it's playable from day 1.
// Real user votes layer on top; the existing daily tally groups both together.

require('dotenv').config();
const supabase = require('../config/supabase');
const { callLLM } = require('./llmService');
const {
  getTomorrowDate,
  getDateFromString,
  formatDateString
} = require('../utils/dateUtils');
const {
  createQuestionGenerationPrompt,
  createAnswerSeedingPrompt
} = require('./promptTemplates');

const TARGET_QUEUE_DAYS = 7;
const RECENT_QUESTIONS_LIMIT = 30;

/**
 * Parse a JSON array or object out of an LLM response, tolerating wrapping prose.
 */
function parseJsonFromLLM(text) {
  const arrayMatch = text.match(/\[[\s\S]*\]/);
  const objectMatch = text.match(/\{[\s\S]*\}/);
  const jsonStr = arrayMatch ? arrayMatch[0] : (objectMatch ? objectMatch[0] : text);
  return JSON.parse(jsonStr);
}

/**
 * Questions scheduled for tomorrow or later that haven't been played yet.
 */
async function getUpcomingQuestions() {
  const tomorrowDate = getTomorrowDate();
  const { data, error } = await supabase
    .from('questions')
    .select('*')
    .gte('active_date', tomorrowDate)
    .order('active_date', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Recent question_texts to pass into the generator as anti-examples (avoid dupes).
 */
async function getRecentQuestions(limit = RECENT_QUESTIONS_LIMIT) {
  const { data, error } = await supabase
    .from('questions')
    .select('question_text')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []).map(r => r.question_text);
}

/**
 * Generate N new candidate questions via Claude.
 * Returns an array of { archetype, category, question } objects.
 */
async function generateQuestions(n, recentQuestions = []) {
  const prompt = createQuestionGenerationPrompt(n, recentQuestions);
  const result = await callLLM(prompt, { maxTokens: 2000, skipCache: true });

  let parsed;
  try {
    parsed = parseJsonFromLLM(result);
  } catch (err) {
    console.error('Failed to parse generator output:', result);
    throw new Error(`Generator returned invalid JSON: ${err.message}`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error('Expected array from generator');
  }

  return parsed.filter(q => q && typeof q.question === 'string' && q.question.trim().length > 0);
}

/**
 * Ask Claude for 5 plausible answers + weights, then insert synthetic vote rows.
 * Each row goes into `votes` with is_seed=true so real engagement can be measured separately.
 * Returns the number of vote rows inserted.
 */
async function seedVotesForQuestion(questionId, questionText) {
  const prompt = createAnswerSeedingPrompt(questionText);
  const result = await callLLM(prompt, { maxTokens: 500, skipCache: true });

  let answers;
  try {
    answers = parseJsonFromLLM(result);
  } catch (err) {
    console.error(`Failed to parse seeder output for question ${questionId}:`, result);
    throw new Error(`Seeder returned invalid JSON: ${err.message}`);
  }

  if (!Array.isArray(answers) || answers.length === 0) {
    throw new Error('Expected non-empty answer array from seeder');
  }

  const voteRows = [];
  for (const { answer, weight } of answers) {
    if (typeof answer !== 'string' || answer.trim().length === 0) continue;
    const normalized = answer.toLowerCase().trim();
    const count = Math.max(1, Math.round(Number(weight) || 0));
    for (let i = 0; i < count; i++) {
      voteRows.push({
        question_id: questionId,
        response: normalized,
        is_seed: true
      });
    }
  }

  if (voteRows.length === 0) {
    throw new Error('No valid seed votes produced');
  }

  const { error } = await supabase.from('votes').insert(voteRows);
  if (error) throw error;

  return voteRows.length;
}

/**
 * Given a YYYY-MM-DD string, return the next day's string in the app timezone.
 */
function nextDateAfter(lastDateString) {
  const d = getDateFromString(lastDateString);
  d.setDate(d.getDate() + 1);
  return formatDateString(d);
}

async function insertGeneratedQuestion(generated, activeDate) {
  const { data, error } = await supabase
    .from('questions')
    .insert([{
      question_text: generated.question,
      active_date: activeDate,
      voting_complete: false,
      source: 'generated'
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Main orchestrator: checks how many upcoming questions we have, generates + seeds
 * enough new ones to reach the target depth. Idempotent — safe to run daily.
 */
async function replenishPipeline(options = {}) {
  const targetDays = options.targetDays || TARGET_QUEUE_DAYS;

  const upcoming = await getUpcomingQuestions();
  console.log(`Content pipeline: ${upcoming.length} upcoming questions (target ${targetDays})`);

  if (upcoming.length >= targetDays) {
    return { generated: 0, seeded: 0, created: [] };
  }

  const needed = targetDays - upcoming.length;
  const recentQuestions = await getRecentQuestions();

  let newQuestions;
  try {
    newQuestions = await generateQuestions(needed, recentQuestions);
  } catch (err) {
    console.error('Question generation failed:', err);
    return { generated: 0, seeded: 0, created: [], error: err.message };
  }

  if (newQuestions.length === 0) {
    console.warn('Generator returned zero usable questions');
    return { generated: 0, seeded: 0, created: [] };
  }

  let nextActiveDate = upcoming.length > 0
    ? nextDateAfter(upcoming[upcoming.length - 1].active_date)
    : getTomorrowDate();

  const created = [];
  let seededCount = 0;

  for (const generated of newQuestions) {
    let question;
    try {
      question = await insertGeneratedQuestion(generated, nextActiveDate);
    } catch (err) {
      console.error(`Failed to insert question "${generated.question}":`, err);
      continue;
    }

    try {
      const n = await seedVotesForQuestion(question.id, question.question_text);
      seededCount += n;
      console.log(`Seeded ${n} votes for "${question.question_text}" (${question.active_date})`);
    } catch (err) {
      console.error(`Seed failed for question ${question.id} ("${question.question_text}"):`, err);
      // Keep the question row — admin can reseed or reject via the review UI.
    }

    created.push(question);
    nextActiveDate = nextDateAfter(nextActiveDate);
  }

  return {
    generated: newQuestions.length,
    seeded: seededCount,
    created
  };
}

module.exports = {
  generateQuestions,
  seedVotesForQuestion,
  replenishPipeline,
  getUpcomingQuestions,
  TARGET_QUEUE_DAYS
};
