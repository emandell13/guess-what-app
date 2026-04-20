// backend/scripts/backfillGuessPrompts.js
//
// One-off: rewrites questions.guess_prompt for rows that still use the old
// pronoun convention. The guess_prompt slots into the in-game sentence
// "What did N people say was ___?" — anything referring to those N voters
// must be third-person plural ("they"/"their"), never "you"/"your" and
// never a second "people" that echoes the outer "N people".
//
// Usage:
//   node backend/scripts/backfillGuessPrompts.js          # dry-run, prints diffs
//   node backend/scripts/backfillGuessPrompts.js --apply  # writes changes to DB

require('dotenv').config();
const supabase = require('../config/supabase');
const { callLLM } = require('../services/llmService');

const APPLY = process.argv.includes('--apply');

const RULE = `The guess_prompt is the noun-phrase that slots into the in-game
sentence: "What did N people say was ___?". The "N people" are the voters.

Anything inside the guess_prompt that refers to those voters must use
third-person plural ("they"/"their"/"themselves"):
- Convert "you" → "they", "your" → "their", "you'd" → "they'd",
  "you're" → "they're", "you've" → "they've", "you'll" → "they'll",
  "yourself" → "themselves".
- If the guess_prompt's embedded clause starts with "people …" echoing the
  outer "N people" (e.g. "the first thing people do when they get home
  from work"), change that subject "people" to "they".
- LEAVE "people" alone when it means people-in-general and modifies the
  noun rather than echoing the voters (e.g. "a chore people hate doing"
  is correct — "people" there describes the chore, not the voters).
- Do not otherwise rewrite — preserve wording, tense, and meaning.
- Output lowercase, no leading article when awkward, no trailing punctuation.`;

function buildPrompt(questionText, currentGuessPrompt) {
  return `${RULE}

QUESTION: ${JSON.stringify(questionText)}
CURRENT guess_prompt: ${JSON.stringify(currentGuessPrompt)}

Return ONLY a JSON object of the form {"guess_prompt": "..."}. If the current
value already follows the rule, return it unchanged.`;
}

async function rewriteOne(question) {
  const prompt = buildPrompt(question.question_text, question.guess_prompt);
  const raw = await callLLM(prompt, {
    maxTokens: 200,
    skipCache: true,
    model: 'claude-opus-4-7'
  });

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  const parsed = JSON.parse(jsonMatch[0]);
  const next = typeof parsed.guess_prompt === 'string' ? parsed.guess_prompt.trim() : null;
  if (!next) return null;
  return next;
}

async function run() {
  const { data: questions, error } = await supabase
    .from('questions')
    .select('id, question_text, guess_prompt')
    .not('guess_prompt', 'is', null);

  if (error) {
    console.error('Error fetching questions:', error);
    process.exit(1);
  }

  if (!questions || questions.length === 0) {
    console.log('No questions found.');
    return;
  }

  console.log(`Checking ${questions.length} questions (${APPLY ? 'APPLY' : 'DRY-RUN'})...\n`);

  let changed = 0;
  let unchanged = 0;
  let failed = 0;

  for (const q of questions) {
    try {
      const next = await rewriteOne(q);
      if (!next) {
        console.warn(`[${q.id}] no output — skipping`);
        failed++;
        continue;
      }

      if (next === q.guess_prompt) {
        unchanged++;
        continue;
      }

      console.log(`[${q.id}] ${JSON.stringify(q.question_text)}`);
      console.log(`  before: ${JSON.stringify(q.guess_prompt)}`);
      console.log(`  after:  ${JSON.stringify(next)}`);

      if (APPLY) {
        const { data: updated, error: updateError } = await supabase
          .from('questions')
          .update({ guess_prompt: next })
          .eq('id', q.id)
          .select('id, guess_prompt');
        if (updateError) {
          console.error(`  update failed:`, updateError);
          failed++;
          continue;
        }
        if (!updated || updated.length === 0) {
          console.error(`  update returned no rows — likely RLS blocked the write`);
          failed++;
          continue;
        }
      }
      changed++;
    } catch (err) {
      console.error(`[${q.id}] error:`, err.message);
      failed++;
    }
  }

  console.log(`\nDone. ${changed} ${APPLY ? 'updated' : 'would update'}, ${unchanged} unchanged, ${failed} failed.`);
  if (!APPLY && changed > 0) {
    console.log(`Re-run with --apply to write changes.`);
  }
}

run().then(() => process.exit(0)).catch(err => {
  console.error('Backfill crashed:', err);
  process.exit(1);
});
