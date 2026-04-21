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
 * Shared good/bad example pairs used by both the generation and rating prompts.
 * Keeping them in one place so the two calls judge against the same taste anchor.
 */
const HINT_GOOD_EXAMPLES = [
  { q: "Name something on a coworker's desk that makes you judge them", a: "energy drink cans", hint: "Aluminum anxiety" },
  { q: "Name something on a coworker's desk that makes you judge them", a: "inspirational quote", hint: "The pep talk you didn't ask for" },
  { q: "Name something people fake having in their twenties", a: "liking your job", hint: "The office romance illusion" },
  { q: "Name something that ruins a road trip", a: "a snoring passenger", hint: "Shotgun becomes a sawmill" },
  { q: "Name something that ruins a road trip", a: "traffic on day one", hint: "Vacation stalls before it starts" },
  { q: "Name something your dad has strong opinions about", a: "the thermostat", hint: "Touch the dial, face the wrath" }
];

const HINT_BAD_EXAMPLES = [
  {
    q: "Name something your dad has strong opinions about",
    a: "local weather",
    hint: "His personal forecast beats the meteorologist",
    why: 'uses "forecast" and "meteorologist" — direct synonyms of weather'
  },
  {
    q: "Name something your dad has strong opinions about",
    a: "how to load the dishwasher",
    hint: "Tetris, but with plates and forks",
    why: 'names "plates and forks" — the exact objects being loaded'
  },
  {
    q: "Name something your dad has strong opinions about",
    a: "how to grill",
    hint: "Flame whisperer, tongs in hand",
    why: 'names "flame" and "tongs" — the tools and material of grilling'
  }
];

function formatGoodExamples() {
  return HINT_GOOD_EXAMPLES.map(e =>
    `- Q: "${e.q}"\n  A: "${e.a}" → "${e.hint}"`
  ).join('\n');
}

function formatBadExamples() {
  return HINT_BAD_EXAMPLES.map(e =>
    `- Q: "${e.q}"\n  A: "${e.a}" → "${e.hint}"\n  (${e.why})`
  ).join('\n');
}

/**
 * Prompt template for GENERATING hint candidates for a question's top answers.
 * Asks for multiple candidates per answer so a separate rating pass can pick the
 * best. Batching keeps the model aware of the whole answer set.
 * @param {string} questionText - The question text
 * @param {Array<string>} answers - The top answers, in rank order (#1 → #N)
 * @param {number} candidatesPerAnswer - How many candidate hints to generate per answer
 * @returns {string} - Formatted prompt
 */
function createHintGenerationPrompt(questionText, answers, candidatesPerAnswer = 3) {
  const answerList = answers
    .map((a, i) => `${i + 1}. ${a}`)
    .join('\n');

  return `
You're writing hints for a Family Feud-style daily trivia game called "Guess What!"
Each answer gets one hint the player can reveal when stuck. For each answer below,
generate ${candidatesPerAnswer} DIFFERENT candidate hints — a separate rating pass
will pick the best one.

QUESTION: "${questionText}"

TOP ANSWERS (${candidatesPerAnswer} candidates for each, in order):
${answerList}

GOAL: Each candidate must still make the answer VERY HARD to solve — even with the
question for context, it should take real thought to interpret. If a player could guess
the answer in under 3 seconds of reading hint + question together, the hint is too easy.

A great hint is CLEVER. Wordplay, wit, cultural references, juxtaposition,
recontextualized idioms are all encouraged.

Keep hints tight: short phrases, not vivid sentences. Don't paint the scene — point
at it sideways.

Make the ${candidatesPerAnswer} candidates for each answer GENUINELY DIFFERENT — try
different techniques (one juxtaposition, one cultural reference, one implied social
dynamic, etc.) — so the rater has a real choice.

Examples of hints that WORK:
${formatGoodExamples()}

Examples of hints that are TOO EASY — do NOT write hints like these. They name specific
objects or terms directly from the answer's scene, which gives the answer away:
${formatBadExamples()}

FORMAT RULES:
- Max 55 characters per hint
- Do not use the answer word, the question's key words, or direct synonyms of them
- Do not use double (") or single (') quote characters inside the hint text
- Sentence case, no surrounding quotes, no ending punctuation

Return ONLY valid JSON in this exact shape, no prose:
[
  { "rank": 1, "answer": "...", "candidates": ["...", "...", "..."] },
  { "rank": 2, "answer": "...", "candidates": ["...", "...", "..."] },
  ...
]
`.trim();
}

/**
 * Prompt template for RATING hint candidates and picking the best per answer.
 * The rater compares each candidate to the anchor good/bad examples and picks the
 * one closest to the good pile and furthest from the bad pile.
 * @param {string} questionText - The question text
 * @param {Array<{rank:number,answer:string,candidates:string[]}>} rows
 * @returns {string} - Formatted prompt
 */
function createHintRatingPrompt(questionText, rows) {
  const candidatesBlock = rows.map(row => {
    const opts = row.candidates
      .map((c, i) => `   ${String.fromCharCode(97 + i)}) "${c}"`)
      .join('\n');
    return `${row.rank}. Answer: "${row.answer}"\n${opts}`;
  }).join('\n\n');

  return `
You're rating hint candidates for a Family Feud-style trivia game. For each answer
below, you'll see multiple candidate hints. Pick the BEST one per answer.

QUESTION: "${questionText}"

A GREAT hint is close to these examples — they don't name objects or terms from the
answer's scene; they use juxtaposition, cultural references, implied dynamics,
recontextualized idioms, or attitudes:
${formatGoodExamples()}

A hint is TOO EASY (and should be rejected) when it looks like these — they name
specific objects or use direct synonyms, so a player would guess the answer instantly:
${formatBadExamples()}

WHEN RATING, apply these tests to each candidate:
1. Could a player guess the answer in under 3 seconds of reading hint + question? If
   yes, reject it — too obvious.
2. Does the hint name a specific object, tool, material, or term directly from the
   answer's scene? If yes, reject it.
3. Does every word of the hint map to a direct synonym for the answer or a question
   word? If yes, reject it.
4. Among the remaining candidates, pick the one that is most clever — juxtaposition,
   cultural reference, recontextualized idiom, or implied social dynamic.
If all candidates fail tests 1-3, pick the least-bad one.

CANDIDATES:

${candidatesBlock}

For each answer, return the letter of the best candidate AND the actual hint text.

Return ONLY valid JSON in this exact shape, no prose:
[
  { "rank": 1, "answer": "...", "best_letter": "a", "winner": "..." },
  { "rank": 2, "answer": "...", "best_letter": "b", "winner": "..." },
  ...
]
`.trim();
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

EACH question needs a "guess_prompt" — the noun-phrase that slots into the
in-game guessing sentence: "What did N people say was ___?". It should be
lowercase, no leading article when awkward, and no trailing punctuation.

PRONOUN RULE — the "N people" in the outer sentence are the voters. Anything
inside the guess_prompt that refers to *them* must use third-person plural
("they" / "their" / "themselves"), never second-person ("you" / "your") and
never a second "people" that echoes the outer "N people":
- When the source question addresses the voter in 2nd person ("What's the
  first thing YOU do…", "Name something YOU'D hide…"), convert YOU→THEY and
  YOUR→THEIR in the guess_prompt so the clause refers back to the N voters.
- Only keep "people" inside the guess_prompt when it means people-in-general
  and is NOT the subject of the embedded clause (e.g. "a chore people hate
  doing" is fine — "people" modifies the chore, it isn't echoing the voters).

Examples:
- question: "Name a chore people hate doing." → guess_prompt: "a chore people hate doing"
- question: "What's the first thing you do when you get home from work?" → guess_prompt: "the first thing they do when they get home from work"
- question: "Name something you'd hide from your in-laws." → guess_prompt: "something they'd hide from their in-laws"

Generate exactly ${n} NEW questions (not in the forbidden list above). Return ONLY valid JSON, no prose:
[
  { "archetype": "...", "category": "...", "question": "...", "guess_prompt": "..." },
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

/**
 * Prompt for a host reaction to a DUPLICATE correct guess. The player's raw
 * text may differ from the canonical (e.g. "cell phone" → "check phone"), so
 * the host should acknowledge the fuzzy match in their voice. Fast path —
 * called the moment the client detects a duplicate, so Haiku-class.
 *
 * @param {string} questionText
 * @param {string} userGuess - what the player typed this time
 * @param {string} canonicalAnswer - the answer they'd already solved
 * @returns {string}
 */
function createAlreadyGuessedCommentaryPrompt(questionText, userGuess, canonicalAnswer) {
  const exact = String(userGuess || '').trim().toLowerCase() ===
                String(canonicalAnswer || '').trim().toLowerCase();
  return `
You're the host of a Family Feud-style daily trivia game called "Guess What!"
A player just submitted an answer that maps to one they already got. Write ONE short
host line reacting to the overlap. The line appears in a bubble above the input for ~3s.

VOICE: Punchy, observational, warm with a bit of edge. Think of a sharp host who's
been watching the scoreboard and just noticed the player circling back.

QUESTION: "${questionText}"
THEIR NEW GUESS: "${userGuess}"
ANSWER THEY ALREADY SOLVED: "${canonicalAnswer}"
EXACT_REPEAT: ${exact ? 'yes' : 'no'}

TONE:
- If EXACT_REPEAT is yes: they literally retyped the same answer. Acknowledge it and
  nudge them to try another, in a "you already got that one" way.
- If EXACT_REPEAT is no: the new guess is semantically the same as the canonical —
  call out the overlap in a fun way. Reference both phrasings so the player
  understands why it counted. E.g. "'Cell phone' is just 'check phone' in a trench
  coat — already on the board."

HARD RULES:
- 1 sentence, under 110 characters.
- Reference the player's actual guess. If EXACT_REPEAT is no, reference both the
  new guess and the canonical answer so the overlap is legible.
- Don't roast the player — tease the guess or the crowd, not the person.
- No emoji, no hashtags, no exclamation-mark spam.
- Don't explain the rules. Don't say "try again" — the UI handles that.
- Don't start with "Ooh" or "Bold." — those are closeness-feedback templates.

Return ONLY the line text, no quotes, no JSON, no preamble.
`.trim();
}

module.exports = {
  createGuessMatchingPrompt,
  createAnswerGroupingPrompt,
  createHintGenerationPrompt,
  createHintRatingPrompt,
  createQuestionGenerationPrompt,
  createAnswerSeedingPrompt,
  createQuipPrompt,
  createWrongGuessCommentaryPrompt,
  createAlreadyGuessedCommentaryPrompt,
  ARCHETYPES,
  CATEGORIES,
  GOLD_EXAMPLES,
  HINT_GOOD_EXAMPLES,
  HINT_BAD_EXAMPLES
};