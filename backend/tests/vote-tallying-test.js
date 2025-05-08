// backend/tests/vote-tallying-test.js

const { callLLM } = require('../services/llmService');
const { createAnswerGroupingPrompt } = require('../services/promptTemplates');

async function testVoteTallying() {
  try {
    console.log("Testing vote tallying...");
    
    // Test the groupVotesWithLLM function directly
    const testVotes = [
      "Shoes", "Boots", "Sandals", "Socks", "Sneakers", "Tennis shoes", 
      "Slippers", "Running shoes", "Flip flops", "High heels", "Garbage bags", "Pizza"
    ];
    const testQuestion = "What's something you wear on your feet?";
    
    console.log(`Test question: "${testQuestion}"`);
    console.log(`Test votes: ${testVotes.join(', ')}`);
    
    // Create the prompt
    const prompt = createAnswerGroupingPrompt(testVotes, testQuestion);
    
    // Call the LLM
    console.log("\nCalling LLM API...");
    const result = await callLLM(prompt);
    
    // Display result
    console.log("\nResult:");
    console.log(result);
    
    // Parse the result
    try {
      const groupedVotes = JSON.parse(result);
      console.log("\nParsed Result:");
      
      // Display excluded answers first if any
      if (groupedVotes.EXCLUDED_ANSWERS && groupedVotes.EXCLUDED_ANSWERS.length > 0) {
        console.log("Excluded Answers:");
        const excludedItems = groupedVotes.EXCLUDED_ANSWERS.map(idx => testVotes[idx-1]);
        console.log(`- ${excludedItems.join(', ')}`);
        delete groupedVotes.EXCLUDED_ANSWERS; // Remove from object for next loop
      } else {
        console.log("No answers were excluded.");
      }
      
      // Display grouped answers
      console.log("Grouped Answers:");
      Object.entries(groupedVotes).forEach(([canonical, indices]) => {
        if (canonical === "EXCLUDED_ANSWERS") return; // Skip if it wasn't already processed
        const items = indices.map(idx => testVotes[idx-1]);
        console.log(`- "${canonical}": ${items.join(', ')}`);
      });
      
      // Additional analysis
      const answerCounts = {};
      Object.entries(groupedVotes).forEach(([canonical, indices]) => {
        answerCounts[canonical] = indices.length;
      });
      
      console.log("\nAnswer Counts:");
      Object.entries(answerCounts)
        .sort((a, b) => b[1] - a[1])
        .forEach(([answer, count]) => {
          console.log(`- "${answer}": ${count} votes`);
        });
      
    } catch (e) {
      console.error("Error parsing JSON result:", e);
    }
    
  } catch (error) {
    console.error("Error testing vote tallying:", error);
  }
}

testVoteTallying();