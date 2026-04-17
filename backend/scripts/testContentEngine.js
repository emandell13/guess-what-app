// backend/scripts/testContentEngine.js
//
// Dry-run smoke test for the content engine prompts. Calls Claude for question
// generation and answer seeding, prints the output, writes nothing to the DB.
// Run: node backend/scripts/testContentEngine.js

require('dotenv').config();
const { callLLM } = require('../services/llmService');
const {
  createQuestionGenerationPrompt,
  createAnswerSeedingPrompt
} = require('../services/promptTemplates');

const BATCH_SIZE = 3;

function parseJsonFromLLM(text) {
  const arrayMatch = text.match(/\[[\s\S]*\]/);
  const objectMatch = text.match(/\{[\s\S]*\}/);
  const jsonStr = arrayMatch ? arrayMatch[0] : (objectMatch ? objectMatch[0] : text);
  return JSON.parse(jsonStr);
}

async function run() {
  console.log(`\n=== GENERATING ${BATCH_SIZE} QUESTIONS ===\n`);
  const genPrompt = createQuestionGenerationPrompt(BATCH_SIZE, []);
  const genResult = await callLLM(genPrompt, { maxTokens: 2000, skipCache: true });

  let questions;
  try {
    questions = parseJsonFromLLM(genResult);
  } catch (err) {
    console.error('Failed to parse generator output. Raw:\n', genResult);
    process.exit(1);
  }

  questions.forEach((q, i) => {
    console.log(`${i + 1}. [${q.archetype} / ${q.category}]`);
    console.log(`   ${q.question}\n`);
  });

  console.log(`\n=== SEEDING ANSWERS ===\n`);
  for (const q of questions) {
    const seedPrompt = createAnswerSeedingPrompt(q.question);
    const seedResult = await callLLM(seedPrompt, { maxTokens: 500, skipCache: true });

    let answers;
    try {
      answers = parseJsonFromLLM(seedResult);
    } catch (err) {
      console.error(`Seed parse failed for "${q.question}". Raw:\n`, seedResult);
      continue;
    }

    const totalWeight = answers.reduce((sum, a) => sum + (Number(a.weight) || 0), 0);
    console.log(`Q: ${q.question}`);
    answers.forEach((a, i) => {
      console.log(`   ${i + 1}. ${a.answer} (weight: ${a.weight})`);
    });
    console.log(`   total weight: ${totalWeight}\n`);
  }
}

run().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
