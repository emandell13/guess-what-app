// backend/tests/llm-prompts-test.js

const { createGuessMatchingPrompt, createAnswerGroupingPrompt } = require('../services/promptTemplates');
const { callLLM } = require('../services/llmService');

// Test cases for both guess matching and answer grouping
const testCases = [
  {
    category: "Board Games",
    question: "What's your favorite board game?",
    guesses: [
      { guess: "Catan", possibleAnswers: ["Monopoly", "Scrabble", "Settlers of Catan", "Chess", "Risk"] },
      { guess: "Chess", possibleAnswers: ["Monopoly", "Scrabble", "Settlers of Catan", "Chess", "Risk"] },
      { guess: "checkers", possibleAnswers: ["Monopoly", "Scrabble", "Settlers of Catan", "Chess", "Risk"] }
    ],
    answers: [
      "Monopoly", "Risk", "Scrabble", "Catan", "Settlers of Catan", "Chess", "Checkers", 
      "Sorry", "Clue", "Candyland", "Ticket to Ride", "Videogames", "Phone"
    ]
  },
  {
    category: "Drinks",
    question: "What's the best drink on a hot day?",
    guesses: [
      { guess: "Ice tea", possibleAnswers: ["Water", "Lemonade", "Iced tea", "Beer", "Soda"] },
      { guess: "Iced coffee", possibleAnswers: ["Water", "Lemonade", "Iced tea", "Beer", "Soda"] },
      { guess: "water", possibleAnswers: ["Water", "Lemonade", "Iced tea", "Beer", "Soda"] }
    ],
    answers: [
      "Water", "Lemonade", "Iced tea", "Hot chocolate", "Beer", "Bleach", 
      "Coffee", "Margarita", "Ice cream soda", "Milk", "Hot coffee"
    ]
  },
  {
    category: "Footwear",
    question: "What's something you wear on your feet?",
    guesses: [
      { guess: "sneakers", possibleAnswers: ["Shoes", "Boots", "Sandals", "Socks", "Slippers"] },
      { guess: "tennis shoes", possibleAnswers: ["Shoes", "Boots", "Sandals", "Socks", "Slippers"] },
      { guess: "flip flops", possibleAnswers: ["Shoes", "Boots", "Sandals", "Socks", "Slippers"] }
    ],
    answers: [
      "Shoes", "Boots", "Sandals", "Socks", "Sneakers", "Tennis shoes", 
      "Slippers", "Running shoes", "Flip flops", "High heels", "Garbage bags", "Pizza"
    ]
  }
];

// Run all tests
async function runTests() {
  for (const testCase of testCases) {
    console.log(`\n=== Testing ${testCase.category}: "${testCase.question}" ===\n`);
    
    // Test guess matching
    console.log("--- Guess Matching Tests ---");
    for (const guessTest of testCase.guesses) {
      const { guess, possibleAnswers } = guessTest;
      console.log(`\nTesting guess: "${guess}"`);
      console.log(`Possible answers: ${possibleAnswers.join(', ')}`);
      
      const prompt = createGuessMatchingPrompt(guess, possibleAnswers, testCase.question);
      const result = await callLLM(prompt);
      
      console.log(`Result: ${result}`);
      console.log(`Match found: ${result !== "NO_MATCH" ? "YES ✓" : "NO ✗"}`);
    }
    
    // Test answer grouping
    console.log("\n--- Answer Grouping Test ---");
    console.log(`Answers to group: ${testCase.answers.join(', ')}`);
    
    const groupingPrompt = createAnswerGroupingPrompt(testCase.answers, testCase.question);
    const groupingResult = await callLLM(groupingPrompt);
    
    console.log("\nGrouping Result:");
    
    try {
      const groupedAnswers = JSON.parse(groupingResult);
      
      // Display excluded answers first if any
      if (groupedAnswers.EXCLUDED_ANSWERS && groupedAnswers.EXCLUDED_ANSWERS.length > 0) {
        console.log("\nExcluded Answers:");
        const excludedItems = groupedAnswers.EXCLUDED_ANSWERS.map(idx => testCase.answers[idx-1]);
        console.log(`- ${excludedItems.join(', ')}`);
        delete groupedAnswers.EXCLUDED_ANSWERS; // Remove from object for next loop
      } else {
        console.log("\nNo answers were excluded.");
      }
      
      // Display grouped answers
      console.log("\nGrouped Answers:");
      Object.entries(groupedAnswers).forEach(([canonical, indices]) => {
        if (canonical === "EXCLUDED_ANSWERS") return; // Skip if it wasn't already processed
        const items = indices.map(idx => testCase.answers[idx-1]);
        console.log(`- "${canonical}": ${items.join(', ')}`);
      });
    } catch (e) {
      console.error("Error parsing JSON result:", e);
    }
  }
}

// Run all tests
console.log("Starting comprehensive prompt tests...");
runTests().then(() => {
  console.log("\nAll tests completed!");
}).catch(error => {
  console.error("Error running tests:", error);
});