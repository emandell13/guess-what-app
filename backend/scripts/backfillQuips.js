// backend/scripts/backfillQuips.js
//
// One-off: fills questions.quips (JSONB array of {targetRank, text}) for
// questions that were tallied before the multi-quip host-commentary work
// shipped. Only touches rows where quips IS NULL so it's idempotent and safe
// to re-run.
//
// Runs on Sonnet for better comedy quality (same model as the live
// dailyUpdate quip generation).
//
// Usage: `node backend/scripts/backfillQuips.js`

require('dotenv').config();
const supabase = require('../config/supabase');
const { callLLM } = require('../services/llmService');
const { createQuipPrompt } = require('../services/promptTemplates');

async function backfill() {
  const { data: questions, error } = await supabase
    .from('questions')
    .select('id, question_text')
    .eq('voting_complete', true)
    .is('quips', null);

  if (error) {
    console.error('Error fetching questions:', error);
    process.exit(1);
  }

  if (!questions || questions.length === 0) {
    console.log('No questions need backfill.');
    return;
  }

  console.log(`Backfilling quips for ${questions.length} questions...`);

  let success = 0;
  let skipped = 0;
  let failed = 0;

  for (const question of questions) {
    const { data: answers, error: answersError } = await supabase
      .from('top_answers')
      .select('rank, answer, vote_count')
      .eq('question_id', question.id)
      .order('rank', { ascending: true });

    if (answersError || !answers || answers.length === 0) {
      console.warn(`Skipping ${question.id} — no top_answers rows`);
      skipped++;
      continue;
    }

    const topFive = answers.slice(0, 5).map(a => ({
      rank: a.rank,
      answer: a.answer,
      voteCount: a.vote_count
    }));

    try {
      const prompt = createQuipPrompt(question.question_text, topFive);
      const raw = await callLLM(prompt, {
        maxTokens: 500,
        skipCache: true,
        model: 'claude-sonnet-4-6'
      });

      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn(`No JSON for ${question.id}`);
        skipped++;
        continue;
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
        console.log(`No quip targets for ${question.id} ("${question.question_text}")`);
        skipped++;
        continue;
      }

      const { error: updateError } = await supabase
        .from('questions')
        .update({ quips: validQuips })
        .eq('id', question.id);

      if (updateError) {
        console.error(`Update failed for ${question.id}:`, updateError);
        failed++;
      } else {
        console.log(`[${question.id}] ${validQuips.length} quips:`);
        validQuips.forEach(q => console.log(`  rank=${q.targetRank} "${q.text}"`));
        success++;
      }
    } catch (err) {
      console.error(`Error on ${question.id}:`, err.message);
      failed++;
    }
  }

  console.log(`\nDone. ${success} filled, ${skipped} skipped (no target), ${failed} failed.`);
}

backfill().then(() => process.exit(0)).catch(err => {
  console.error('Backfill crashed:', err);
  process.exit(1);
});
