// backend/scripts/testHintGeneration.js
//
// Dry-run smoke test for the two-pass hint-generation flow:
// 1) ask the model for N candidates per answer
// 2) ask the model to rate the candidates and pick the best
// Prints candidates + winner for each answer, writes nothing to the DB.
// Run: source .env && node backend/scripts/testHintGeneration.js

require('dotenv').config();
const { callLLM } = require('../services/llmService');
const {
  createHintGenerationPrompt,
  createHintRatingPrompt
} = require('../services/promptTemplates');

const CANDIDATES_PER_ANSWER = 3;
const HINT_MODEL = 'claude-opus-4-7';

const FIXTURES = [
  {
    question: "Name something that ruins a road trip.",
    answers: ['Arguing about music', 'Gas station food', 'The GPS dying', 'Running out of snacks', 'Losing cell service']
  },
  {
    question: "Name something people fake having in their twenties.",
    answers: ['Being into yoga', 'Loving cooking', 'Knowing wine', 'Reading habits', 'Having it together']
  },
  {
    question: "Name something your dad has strong opinions about.",
    answers: ['How to drive', 'Lawn care', 'Gas prices', 'The news', 'Tools and hardware']
  }
];

function parseJsonFromLLM(text) {
  const arrayMatch = text.match(/\[[\s\S]*\]/);
  return JSON.parse(arrayMatch ? arrayMatch[0] : text);
}

async function runFixture({ question, answers }) {
  console.log(`\n=== ${question} ===`);

  // Pass 1 — candidate generation
  const genPrompt = createHintGenerationPrompt(question, answers, CANDIDATES_PER_ANSWER);
  let genRaw;
  try {
    genRaw = await callLLM(genPrompt, { maxTokens: 1500, skipCache: true, model: HINT_MODEL });
  } catch (err) {
    console.error('  Generation call failed:', err.message);
    return;
  }

  let candidateRows;
  try {
    candidateRows = parseJsonFromLLM(genRaw);
  } catch (err) {
    console.error('  Generation parse failed. Raw:\n', genRaw);
    return;
  }

  const normalized = answers.map((answer, i) => {
    const byRank = candidateRows.find(r => Number(r.rank) === i + 1);
    const row = byRank || candidateRows[i];
    const cleaned = Array.isArray(row?.candidates)
      ? row.candidates.filter(c => typeof c === 'string').map(c => c.trim())
      : [];
    return { rank: i + 1, answer, candidates: cleaned };
  });

  // Pass 2 — rating
  const ratePrompt = createHintRatingPrompt(question, normalized);
  let rateRaw;
  try {
    rateRaw = await callLLM(ratePrompt, { maxTokens: 800, skipCache: true, model: HINT_MODEL });
  } catch (err) {
    console.error('  Rating call failed:', err.message);
    return;
  }

  let verdicts;
  try {
    verdicts = parseJsonFromLLM(rateRaw);
  } catch (err) {
    console.error('  Rating parse failed. Raw:\n', rateRaw);
    return;
  }

  // Render
  normalized.forEach((row, i) => {
    const verdict = verdicts.find(v => Number(v.rank) === i + 1) || verdicts[i];
    const winnerLetter = verdict?.best_letter;
    const winnerIdx = typeof winnerLetter === 'string' ? winnerLetter.charCodeAt(0) - 97 : -1;

    console.log(`\n  ${row.rank}. ${row.answer}`);
    row.candidates.forEach((c, ci) => {
      const letter = String.fromCharCode(97 + ci);
      const marker = ci === winnerIdx ? '✓' : ' ';
      const len = c.length;
      const lenFlag = len > 55 ? ` ⚠${len}` : ` (${len})`;
      console.log(`     ${marker} ${letter}) ${c}${lenFlag}`);
    });
    if (verdict?.winner) {
      console.log(`     → picked: "${verdict.winner}"`);
    }
  });
}

async function run() {
  for (const fixture of FIXTURES) {
    await runFixture(fixture);
  }
}

run().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
