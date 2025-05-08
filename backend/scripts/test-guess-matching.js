// backend/scripts/test-guess-matching.js

const { createGuessMatchingPrompt } = require('../services/promptTemplates');
const { callLLM } = require('../services/llmService');

async function testGuessMatching() {
  try {
    // Test case: Board Game Example
    console.log("=== Board Game Example ===");
    const boardGameQuestion = "What's your favorite board game?";
    const boardGameGuess = "Catan";
    const boardGamePossibleAnswers = ["Monopoly", "Scrabble", "Settlers of Catan", "Chess", "Risk"];
    
    console.log(`Question: "${boardGameQuestion}"`);
    console.log(`User guessed: "${boardGameGuess}"`);
    console.log(`Possible answers: ${boardGamePossibleAnswers.join(', ')}`);
    
    // Create the prompt
    const prompt = createGuessMatchingPrompt(
      boardGameGuess, 
      boardGamePossibleAnswers, 
      boardGameQuestion
    );
    
    // Log the prompt for review
    console.log("\nGenerated Prompt:");
    console.log(prompt);
    
    // Call the LLM
    console.log("\nCalling LLM API...");
    const result = await callLLM(prompt);
    
    // Display result
    console.log("\nResult:");
    console.log(result);
    console.log(`Success: ${result === "Settlers of Catan" ? "YES ✓" : "NO ✗"}`);
    
  } catch (error) {
    console.error("Error testing guess matching:", error);
  }
}

testGuessMatching();