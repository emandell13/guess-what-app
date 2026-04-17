// backend/services/promptTemplates.js

/**
 * Prompt template for matching a user's guess against possible answers
 * @param {string} guess - The user's guess
 * @param {Array<string>} possibleAnswers - List of possible answers to match against
 * @param {string} questionText - The original question text for context
 * @returns {string} - Formatted prompt
 */
function createGuessMatchingPrompt(guess, possibleAnswers, questionText) {
  return `
Question: "${questionText}"
User guessed: "${guess}"
Possible answers: ${possibleAnswers.map(a => `"${a}"`).join(', ')}

Determine if the guess would be considered the SAME ANSWER as any of the possible answers in a survey or game show.
If most people would count them as the same answer, it's a match.

Your response must be exactly ONE of these:
${possibleAnswers.map(a => `- ${a}`).join('\n')}
- NO_MATCH

Answer:`;
}

/**
* Prompt template for grouping similar answers in vote tallying
* @param {Array<string>} answers - List of answers to group
* @param {string} questionText - The original question text for context
* @returns {string} - Formatted prompt
*/
function createAnswerGroupingPrompt(answers, questionText) {
  return `
Question: "${questionText}"
Answers to group:
${answers.map((answer, i) => `${i+1}. "${answer}"`).join('\n')}

1. First, identify and exclude any answers that are:
   - Clearly inappropriate for the question
   - Logically wrong or contradictory
   - Offensive or nonsensical

2. Then, group the remaining valid answers by considering whether they would be counted as the SAME answer in a survey or game show.
 - If most people would consider them the same answer, group them together
 - If most people would count them as different answers, keep them separate

3. Use the exact number labels (1, 2, 3, etc.) from the answer list above in your response.

Return JSON: {
  "canonical answer 1": [indices of matching answers],
  "canonical answer 2": [indices of matching answers],
  ...
  "EXCLUDED_ANSWERS": [indices of inappropriate or wrong answers]
}
`;
}

/**
 * Prompt template for generating hints for top answers
 * @param {string} answer - The answer to generate a hint for
 * @param {string} questionText - The original question text for context
 * @returns {string} - Formatted prompt
 */
function createHintGenerationPrompt(answer, questionText) {
  return `
Question: "${questionText}"
Top answer: "${answer}"

Create a subtle, non-obvious hint for this answer using one of these techniques:
1. Use metaphor or analogy rather than direct description
2. Reference a distinctive quality without naming the item
3. Allude to origin, history, or cultural significance
4. Use wordplay or puns that relate to the answer
5. Reference an unusual or unexpected aspect of the answer
6. Hint at how it's made or its components without being explicit

The hint MUST:
- Be no more than 40 characters
- Avoid repeating any information from the question
- NOT be obvious to someone who doesn't already know the answer
- Provide just enough direction for an "aha" moment

Format as a short phrase without quotes or punctuation.

Hint:`;
}

const ARCHETYPES = [
  { name: 'Observable scene', desc: 'concrete place + specific character, things you\'d see' },
  { name: 'Confession', desc: 'admit something small and honest' },
  { name: 'Time capsule', desc: 'shared memory of an era' },
  { name: 'Social survival', desc: 'everyday tactic, excuse, or workaround' },
  { name: 'Hypothetical', desc: 'what would you / if you could' },
  { name: 'Superlative', desc: 'best / worst / most ___' },
  { name: 'Public figure / cultural take', desc: 'opinion about something famous' },
  { name: 'Absurd / lateral', desc: 'weird prompt that unlocks creative answers' }
];

const CATEGORIES = [
  'daily life', 'work', 'relationships/dating', 'family',
  'food & drink', 'pop culture', 'tech/internet', 'going out & travel',
  'money/adulting', 'childhood', 'health/body', 'holidays',
  'sports', 'generational'
];

const GOLD_EXAMPLES = [
  { archetype: 'Observable scene', category: 'work', question: "Name something on a coworker's desk that makes you judge them." },
  { archetype: 'Confession', category: 'food & drink', question: "Name something you claim to love to seem cool but secretly find boring." },
  { archetype: 'Time capsule', category: 'tech/internet', question: "Name a piece of 2000s tech everyone thought was the future." },
  { archetype: 'Social survival', category: 'work', question: "Name a tactic for looking busy at work." },
  { archetype: 'Hypothetical', category: 'money/adulting', question: "Name something you'd still be cheap about even if you were rich." },
  { archetype: 'Superlative', category: 'relationships/dating', question: "Name the worst first-date ick." },
  { archetype: 'Public figure / cultural take', category: 'sports', question: "Name a sport that's only fun to play after a few drinks." },
  { archetype: 'Absurd / lateral', category: 'holidays', question: "Name something that ruins Thanksgiving dinner." }
];

/**
 * Prompt for generating new trivia questions for the daily Family Feud-style game.
 * Uses gold-standard examples as voice anchor; forces variety across archetype + category.
 * @param {number} n - Number of questions to generate
 * @param {Array<string>} recentQuestions - Recent question_texts to avoid duplicating
 * @returns {string}
 */
function createQuestionGenerationPrompt(n, recentQuestions = []) {
  const archetypeList = ARCHETYPES.map(a => `- ${a.name}: ${a.desc}`).join('\n');
  const categoryList = CATEGORIES.join(', ');
  const exampleList = GOLD_EXAMPLES.map(
    e => `- [${e.archetype} / ${e.category}] ${e.question}`
  ).join('\n');

  // Fold gold examples into the dedupe list so the generator cannot return them verbatim.
  const goldTexts = GOLD_EXAMPLES.map(e => e.question);
  const allAvoid = [...goldTexts, ...recentQuestions];
  const avoidList = allAvoid.map(q => `- "${q}"`).join('\n');

  return `
You're generating questions for a Family Feud-style daily trivia game called "Guess What!"
Players try to name the most common answers to each question.

VOICE: Punchy, specific, slightly spicy. Observational without being mean. Warm but with edge.
A great question pulls out 5+ varied, culturally-recognizable answers and makes people laugh at least once.

ARCHETYPES (vary across the batch):
${archetypeList}

CATEGORIES (vary across the batch):
${categoryList}

VOICE ANCHORS — these are reference examples to MATCH the voice of, NOT to reuse.
Do NOT output any of these questions, near-paraphrases, or light rewordings.
You MUST generate net-new questions that only share the *tone* and *shape* of these:
${exampleList}

HARD RULES:
- Each question must pull 5+ varied, culturally-legible answers that the average American would recognize instantly
- No niche references, inside jokes, or obscure trivia
- No depressing or dark answer spaces (e.g. "worst thing to find on a partner's phone")
- FORBIDDEN — do not output any of these exact questions OR near-duplicates / paraphrases of them:
${avoidList}

BATCH VARIETY RULES:
- Spread the ${n} questions across different archetypes
- Spread across different categories
- Don't stack multiple questions from the same archetype/category pair

Generate exactly ${n} NEW questions (not in the forbidden list above). Return ONLY valid JSON, no prose:
[
  { "archetype": "...", "category": "...", "question": "..." },
  ...
]
`.trim();
}

/**
 * Prompt for generating seeded top-5 answers with vote weights for a new question.
 * The answers are written into the `votes` table as synthetic votes so the question
 * is playable from day 1, before real user votes roll in.
 * @param {string} questionText - The question to seed answers for
 * @returns {string}
 */
function createAnswerSeedingPrompt(questionText) {
  return `
You're generating seed answers for a Family Feud-style trivia game.
The answers will be inserted as synthetic "votes" so the question is playable before real users vote.

QUESTION: "${questionText}"

Generate exactly 5 plausible top answers with weights that feel like real crowd survey results.

HARD RULES:
- Answers must be culturally legible to the average American user — NOT niche
- Avoid obscure brand names, subculture references, or jargon most people won't recognize
- Each answer should be instantly-recognizable when read aloud
- Answers should be varied — do NOT give 5 slight variations of the same thing
- Answers should be specific and alive, not generic ("stuff", "things", "something")
- Each answer string should be short: roughly 1-5 words

WEIGHT RULES:
- Weights represent how many synthetic votes each answer gets
- Total weight should sum to ~20
- Natural falloff: top answer ~6-8, descending to ~2 at the bottom
- Don't make it flat (5/4/4/4/3) or too spiky (15/2/1/1/1)

Return ONLY valid JSON, no prose:
[
  { "answer": "...", "weight": 7 },
  { "answer": "...", "weight": 5 },
  { "answer": "...", "weight": 4 },
  { "answer": "...", "weight": 2 },
  { "answer": "...", "weight": 2 }
]
`.trim();
}

/**
 * Prompt for generating 2-3 host-voice barbs, each tied to a DIFFERENT top-5
 * answer. Claude picks which ranks land (not always #1) and writes one sharp
 * line per target. Multiple quips per question mean multiple host moments per
 * game, so pacing feels alive even if the player doesn't hit the single
 * funniest rank.
 *
 * Voice anchor mirrors the question-generation prompt so the host feels like
 * the same narrator across reveals, wrong-guess quips, and question copy.
 *
 * @param {string} questionText
 * @param {Array<{rank:number, answer:string, voteCount:number}>} topFive
 * @returns {string}
 */
function createQuipPrompt(questionText, topFive) {
  const answerList = topFive
    .map(a => `${a.rank}. "${a.answer}" (${a.voteCount} votes)`)
    .join('\n');

  return `
You're the host of a Family Feud-style daily trivia game called "Guess What!"
Players reveal the top-5 answers one at a time. Pick 2-3 of the answers with
the best comedy potential and write one host line for each, so a single game
has multiple host moments. Each line appears in a bubble above the game board
for ~2.5s when that specific answer is revealed.

VOICE: Punchy, specific, slightly spicy. Observational without being mean.
Warm but with edge. Think: a sharp host who's been watching the scoreboard
and has a take. NOT a corny game-show bit. No "the people have spoken," no
forced-folksy phrasing, no "wow / apparently / well well well" openers.

QUESTION: "${questionText}"

TOP 5 ANSWERS (with real vote counts — use the counts as material if it helps):
${answerList}

HARD RULES:
- Pick 2-3 DIFFERENT ranks (never repeat a rank). Do not always include #1.
  Pick whichever ranks have the best material — the funniest, the most
  predictable, the most surprising, the most revealing about who voted for it.
- If fewer than 2 answers have real comedy potential, return fewer — or an
  empty array. Better to stay silent on weak material than ship flat lines.
- Each line must be 1 sentence, under 100 characters.
- Each line must reference its specific answer (the text OR a clear allusion).
  Never generic commentary about the question as a whole.
- No emoji, no hashtags, no exclamation-mark spam.
- Don't punch at the player. Punch at the answer or at the cultural truth it
  reveals.
- The 2-3 lines should feel different from each other — don't do the same
  joke shape twice in one question.

Return ONLY valid JSON, no prose:
{
  "quips": [
    { "targetRank": <1-5>, "text": "<the line>" },
    ...
  ]
}
`.trim();
}

/**
 * Prompt for generating a live host reaction to a single wrong guess at play time.
 * Called from guessService.checkGuess() on every wrong guess. Must be fast
 * (Haiku-class) and must handle three tones in one pass: solidarity when many
 * others said the same thing, gentle ribbing when nobody did, and a "keep it
 * clean" redirect if the guess is profane or inappropriate.
 *
 * @param {string} questionText
 * @param {string} guess - the raw user guess
 * @param {number} poolCount - how many other voters submitted the same string
 * @returns {string}
 */
function createWrongGuessCommentaryPrompt(questionText, guess, poolCount) {
  return `
You're the host of a Family Feud-style daily trivia game called "Guess What!"
A player just guessed wrong. Write ONE short host line reacting to their specific guess.
The line appears in a bubble above the input for ~2.5s.

VOICE: Punchy, specific, slightly spicy. Observational. Warm but with edge. Think of a
sharp host who's been watching the scoreboard.

QUESTION: "${questionText}"
THEIR WRONG GUESS: "${guess}"
OTHER PLAYERS WHO SUBMITTED THE SAME GUESS: ${poolCount}

TONE — pick based on the guess + pool count:
- If the guess is profane, sexual, slur-adjacent, or otherwise inappropriate for a
  mixed audience: lightly redirect. Warm, not scolding. E.g. "Let's keep it PG." or
  "We're not going there today."
- Else if poolCount >= 2: solidarity. Acknowledge the pool in plain language and
  note that it didn't make the top 5. Include the number naturally. E.g.
  "You and ${poolCount} others — didn't crack top 5." or similar, varied phrasing.
- Else if poolCount === 1: same as above but singular — "You and one other person..."
- Else (poolCount === 0): gentle ribbing. Lean into the fact that literally nobody
  else submitted this. Playful, not cruel. E.g. "Bold move. Nobody else went there."

HARD RULES:
- 1 sentence, under 100 characters.
- Reference the guess itself (quote it or clearly allude to it) unless it's inappropriate —
  in that case, don't repeat it back, just redirect.
- Don't roast the player. Roast the guess or the crowd, not the person.
- No emoji, no hashtags, no exclamation-mark spam.
- Don't explain the rules. Don't say "try again" — the UI handles that.
- Don't start with "Ooh" or "Bold." — those are our old templates; write something fresh.

Return ONLY the line text, no quotes, no JSON, no preamble.
`.trim();
}

module.exports = {
  createGuessMatchingPrompt,
  createAnswerGroupingPrompt,
  createHintGenerationPrompt,
  createQuestionGenerationPrompt,
  createAnswerSeedingPrompt,
  createQuipPrompt,
  createWrongGuessCommentaryPrompt,
  ARCHETYPES,
  CATEGORIES,
  GOLD_EXAMPLES
};