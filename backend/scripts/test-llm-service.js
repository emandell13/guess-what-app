// backend/scripts/test-llm-service.js

const { callLLM } = require('../services/llmService');

async function testLLMService() {
  try {
    console.log("Testing LLM service...");
    
    // First call should hit the API
    console.log("First call (should hit API):");
    const response1 = await callLLM("What is 2+2?");
    console.log("Response:", response1);
    
    // Second identical call should use the cache
    console.log("\nSecond call with same prompt (should use cache):");
    const response2 = await callLLM("What is 2+2?");
    console.log("Response:", response2);
    
    // Third call with force refresh should hit the API again
    console.log("\nThird call with skipCache (should hit API):");
    const response3 = await callLLM("What is 2+2?", { skipCache: true });
    console.log("Response:", response3);
    
    console.log("\nLLM service is working correctly!");
  } catch (error) {
    console.error("Error testing LLM service:", error);
  }
}

testLLMService();