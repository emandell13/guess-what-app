// backend/scripts/test-answer-grouping.js

const { createAnswerGroupingPrompt } = require('../services/promptTemplates');
const { callLLM } = require('../services/llmService');

async function testAnswerGrouping() {
  try {
    // Test case 1: Footwear Example
    console.log("=== Test Case 1: Footwear Example ===");
    const footwearQuestion = "What's something you wear on your feet?";
    const footwearAnswers = [
      "Shoes", "Boots", "Sandals", "Socks", "Sneakers", "Tennis shoes", 
      "Slippers", "Running shoes", "Flip flops", "High heels", "Garbage bags", "Pizza"
    ];
    
    console.log(`Question: "${footwearQuestion}"`);
    console.log(`Answers to group: ${footwearAnswers.join(', ')}`);
    
    // Create the prompt
    const promptFootwear = createAnswerGroupingPrompt(
      footwearAnswers, 
      footwearQuestion
    );
    
    // Call the LLM
    console.log("\nCalling LLM API...");
    const resultFootwear = await callLLM(promptFootwear);
    
    // Display result
    console.log("\nResult:");
    console.log(resultFootwear);
    
    // Parse the result and display in a more readable format
    try {
      const groupedFootwear = JSON.parse(resultFootwear);
      console.log("\nParsed Result:");
      
      // Display excluded answers first if any
      if (groupedFootwear.EXCLUDED_ANSWERS && groupedFootwear.EXCLUDED_ANSWERS.length > 0) {
        console.log("Excluded Answers:");
        const excludedItems = groupedFootwear.EXCLUDED_ANSWERS.map(idx => footwearAnswers[idx-1]);
        console.log(`- ${excludedItems.join(', ')}`);
        delete groupedFootwear.EXCLUDED_ANSWERS; // Remove from object for next loop
      } else {
        console.log("No answers were excluded.");
      }
      
      // Display grouped answers
      console.log("Grouped Answers:");
      Object.entries(groupedFootwear).forEach(([canonical, indices]) => {
        if (canonical === "EXCLUDED_ANSWERS") return; // Skip if it wasn't already processed
        const items = indices.map(idx => footwearAnswers[idx-1]);
        console.log(`- "${canonical}": ${items.join(', ')}`);
      });
    } catch (e) {
      console.error("Error parsing JSON result:", e);
      console.error("Raw result:", resultFootwear);
    }

    // Test case 2: Hot Day Drinks Example
    console.log("\n\n=== Test Case 2: Hot Day Drinks Example ===");
    const hotDayQuestion = "What's the best drink on a hot day?";
    const drinkAnswers = [
      "Water", "Lemonade", "Iced tea", "Hot chocolate", "Beer", 
      "Bleach", "Coffee", "Margarita", "Ice cream soda"
    ];
    
    console.log(`Question: "${hotDayQuestion}"`);
    console.log(`Answers to group: ${drinkAnswers.join(', ')}`);
    
    // Create the prompt
    const promptDrinks = createAnswerGroupingPrompt(
      drinkAnswers, 
      hotDayQuestion
    );
    
    // Call the LLM
    console.log("\nCalling LLM API...");
    const resultDrinks = await callLLM(promptDrinks);
    
    // Display result
    console.log("\nResult:");
    console.log(resultDrinks);
    
    // Parse the result and display in a more readable format
    try {
      const groupedDrinks = JSON.parse(resultDrinks);
      console.log("\nParsed Result:");
      
      // Display excluded answers first if any
      if (groupedDrinks.EXCLUDED_ANSWERS && groupedDrinks.EXCLUDED_ANSWERS.length > 0) {
        console.log("Excluded Answers:");
        const excludedItems = groupedDrinks.EXCLUDED_ANSWERS.map(idx => drinkAnswers[idx-1]);
        console.log(`- ${excludedItems.join(', ')}`);
        delete groupedDrinks.EXCLUDED_ANSWERS; // Remove from object for next loop
      } else {
        console.log("No answers were excluded.");
      }
      
      // Display grouped answers
      console.log("Grouped Answers:");
      Object.entries(groupedDrinks).forEach(([canonical, indices]) => {
        if (canonical === "EXCLUDED_ANSWERS") return; // Skip if it wasn't already processed
        const items = indices.map(idx => drinkAnswers[idx-1]);
        console.log(`- "${canonical}": ${items.join(', ')}`);
      });
    } catch (e) {
      console.error("Error parsing JSON result:", e);
      console.error("Raw result:", resultDrinks);
    }
    
  } catch (error) {
    console.error("Error testing answer grouping:", error);
  }
}

testAnswerGrouping();