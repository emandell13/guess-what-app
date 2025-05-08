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
  
  Determine if the guess is the SAME EXACT ANSWER as any possible answer, considering the question context.
  - Different names for the same thing should match (e.g., "Catan" matches "Settlers of Catan")
  - Different items, even in the same category, must NOT match (e.g., "iced coffee" ≠ "iced tea")
  
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
     - Logically wrong or contradictory (e.g., "hot cocoa" for "best drink on a hot day")
     - Offensive or nonsensical
  
  2. Then, group the remaining valid answers that refer to the exact same item in everyday conversation.
     Group different names for the same specific item, but keep distinct items separate.
  
  3. Use the exact number labels (1, 2, 3, etc.) from the answer list above in your response.
  
  Return JSON: {
    "canonical answer 1": [indices of matching answers],
    "canonical answer 2": [indices of matching answers],
    ...
    "EXCLUDED_ANSWERS": [indices of inappropriate or wrong answers]
  }
  `;
  }
  
module.exports = {
    createGuessMatchingPrompt,
    createAnswerGroupingPrompt
};