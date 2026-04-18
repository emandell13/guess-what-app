// backend/services/contentEngine.js
//
// Candidate-pool content pipeline. Each daily run:
//   1. Adds N new candidate questions to the pool (no date assigned).
//   2. Picks the top-rated candidate (by player picks) and promotes it to
//      tomorrow's scheduled question, seeding its synthetic answer pool so
//      it's playable from minute one.
//
// Player picks come from the post-completion "Pick your favorite" step
// (3 candidates shown, one tap to favorite). The picked count drives
// promotion ranking; ties break by oldest-in-pool to flush through.

require('dotenv').config();
const supabase = require('../config/supabase');
const { callLLM } = require('./llmService');
const {
  createQuestionGenerationPrompt,
  createAnswerSeedingPrompt
} = require('./promptTemplates');

const TARGET_POOL_SIZE = 10;
const RETIRE_IMPRESSION_THRESHOLD = 30;
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
 * Everything not yet completed — scheduled (with dates) and candidates (no
 * date), ordered with scheduled first by active_date, then candidates by
 * created_at. Used by admin views and the prepare-tomorrow check.
 */
async function getUpcomingQuestions() {
  const { data, error } = await supabase
    .from('questions')
    .select('*')
    .neq('status', 'completed')
    .order('active_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Candidate pool only — questions awaiting promotion (no active_date).
 */
async function getCandidatePool() {
  const { data, error } = await supabase
    .from('questions')
    .select('*')
    .eq('status', 'candidate')
    .order('created_at', { ascending: true });

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
 * Called at promotion time (not generation time) so we don't waste seeding work
 * on candidates that may never get promoted.
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
 * Strip the "Name X." or "What's the X?" wrapper from a question, leaving the
 * noun-phrase the in-game guessing UI uses. Fallback when the generator omits
 * an explicit guess_prompt — guess_prompt is NOT NULL in the questions table.
 */
function deriveGuessPrompt(questionText) {
  if (typeof questionText !== 'string') return '';
  let text = questionText.trim().replace(/[?.!]+$/, '');
  // "Name X" / "Name a X" / "Name the X"
  text = text.replace(/^name\s+/i, '');
  // "What's X" / "What is X"
  text = text.replace(/^what(?:'s|\s+is)\s+/i, '');
  // "What do (you|people) X" → "X"
  text = text.replace(/^what\s+do\s+(?:you|people)\s+/i, '');
  return text.trim();
}

/**
 * Insert a generated question into the candidate pool. No date, no seeding —
 * those happen at promotion time.
 */
async function insertGeneratedCandidate(generated) {
  const guessPrompt = (typeof generated.guess_prompt === 'string' && generated.guess_prompt.trim())
    ? generated.guess_prompt.trim()
    : deriveGuessPrompt(generated.question);

  const { data, error } = await supabase
    .from('questions')
    .insert([{
      question_text: generated.question,
      guess_prompt: guessPrompt,
      active_date: null,
      voting_complete: false,
      source: 'generated',
      status: 'candidate'
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Pick the top candidate (most player picks; ties broken by oldest-in-pool),
 * promote it to scheduled with the given active_date, and seed its answer
 * pool. Idempotent — if a question is already scheduled for activeDate, no-op.
 *
 * Returns { promoted, picks, seeded } on success, or { promoted: null, ... }
 * on skip/failure.
 */
async function promoteNextCandidate(activeDate) {
  // Idempotency: if anything is already scheduled for this date, skip.
  const { data: existing, error: existingError } = await supabase
    .from('questions')
    .select('id, question_text')
    .eq('active_date', activeDate)
    .maybeSingle();

  if (existingError && existingError.code !== 'PGRST116') {
    console.error('Error checking existing scheduled question:', existingError);
  }

  if (existing) {
    console.log(`Promotion skipped — already scheduled for ${activeDate}: "${existing.question_text}"`);
    return { promoted: null, skipped: true, reason: 'already_scheduled' };
  }

  const candidates = await getCandidatePool();
  if (candidates.length === 0) {
    console.warn('Promotion failed — candidate pool is empty. Run replenishPipeline first.');
    return { promoted: null, skipped: false, error: 'no_candidates' };
  }

  // Aggregate pick counts in one round-trip.
  const candidateIds = candidates.map(c => c.id);
  const { data: pickRows, error: picksError } = await supabase
    .from('question_picks')
    .select('question_id')
    .in('question_id', candidateIds);

  if (picksError) {
    console.error('Error fetching pick counts (proceeding without ranking):', picksError);
  }

  const pickCounts = {};
  (pickRows || []).forEach(row => {
    pickCounts[row.question_id] = (pickCounts[row.question_id] || 0) + 1;
  });

  // Highest pick count first, ties broken by oldest in pool.
  const ranked = candidates.slice().sort((a, b) => {
    const pa = pickCounts[a.id] || 0;
    const pb = pickCounts[b.id] || 0;
    if (pb !== pa) return pb - pa;
    return new Date(a.created_at) - new Date(b.created_at);
  });

  const winner = ranked[0];
  const winnerPicks = pickCounts[winner.id] || 0;
  console.log(`Promoting candidate "${winner.question_text}" (${winnerPicks} picks) to ${activeDate}`);

  const { error: updateError } = await supabase
    .from('questions')
    .update({ status: 'scheduled', active_date: activeDate })
    .eq('id', winner.id);
  if (updateError) throw updateError;

  let seeded = 0;
  try {
    seeded = await seedVotesForQuestion(winner.id, winner.question_text);
    console.log(`Seeded ${seeded} votes for promoted question ${winner.id}`);
  } catch (err) {
    console.error(`Seed failed for promoted question ${winner.id} ("${winner.question_text}"):`, err);
    // Promotion stands — admin can reseed via the review UI.
  }

  return { promoted: winner, picks: winnerPicks, seeded };
}

/**
 * Retire candidates that have been shown at least `impressionThreshold` times
 * without accumulating a single pick. Fair dud-detection — rather than calendar
 * age, we use actual exposure to decide whether a candidate has had its chance.
 * Retired rows stay in the table (status='retired') for analytics; they're
 * excluded from candidate queries.
 */
async function retireDuds(options = {}) {
  const threshold = options.impressionThreshold || RETIRE_IMPRESSION_THRESHOLD;

  const { data: exposed, error: exposedError } = await supabase
    .from('questions')
    .select('id, question_text, impression_count')
    .eq('status', 'candidate')
    .gte('impression_count', threshold);

  if (exposedError) throw exposedError;
  if (!exposed || exposed.length === 0) return { retired: [] };

  const exposedIds = exposed.map(c => c.id);
  const { data: pickRows, error: pickError } = await supabase
    .from('question_picks')
    .select('question_id')
    .in('question_id', exposedIds);

  if (pickError) {
    console.error('Error checking picks during retirement (skipping retire):', pickError);
    return { retired: [], error: pickError.message };
  }

  const pickedIds = new Set((pickRows || []).map(r => r.question_id));
  const dudIds = exposedIds.filter(id => !pickedIds.has(id));

  if (dudIds.length === 0) return { retired: [] };

  const { data: retired, error: updateError } = await supabase
    .from('questions')
    .update({ status: 'retired' })
    .in('id', dudIds)
    .select('id, question_text, impression_count');

  if (updateError) throw updateError;

  (retired || []).forEach(r => {
    console.log(`Retired dud candidate: "${r.question_text}" (${r.impression_count} impressions, 0 picks)`);
  });

  return { retired: retired || [] };
}

/**
 * Generate just enough new candidates to bring the pool up to the target
 * size. Self-throttling — if the pool is already full, no generation happens;
 * if retirement drained it, we catch up. Matches consumption (1/day via
 * promotion + occasional retirement) rather than a fixed generation rate.
 */
async function replenishPipeline(options = {}) {
  const targetSize = options.targetSize || TARGET_POOL_SIZE;

  const { count, error: countError } = await supabase
    .from('questions')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'candidate');

  if (countError) throw countError;

  const currentSize = count || 0;
  const needed = Math.max(0, targetSize - currentSize);

  if (needed === 0) {
    console.log(`Candidate pool at ${currentSize}/${targetSize}; no generation needed`);
    return { generated: 0, seeded: 0, created: [], poolSize: currentSize };
  }

  console.log(`Candidate pool at ${currentSize}/${targetSize}; generating ${needed}`);

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

  const created = [];
  for (const generated of newQuestions) {
    try {
      const question = await insertGeneratedCandidate(generated);
      created.push(question);
      console.log(`Added candidate: "${question.question_text}"`);
    } catch (err) {
      console.error(`Failed to insert candidate "${generated.question}":`, err);
    }
  }

  return {
    generated: newQuestions.length,
    seeded: 0, // Seeding deferred to promotion.
    created,
    poolSize: currentSize + created.length
  };
}

module.exports = {
  generateQuestions,
  seedVotesForQuestion,
  replenishPipeline,
  retireDuds,
  promoteNextCandidate,
  getUpcomingQuestions,
  getCandidatePool,
  TARGET_POOL_SIZE,
  RETIRE_IMPRESSION_THRESHOLD
};
