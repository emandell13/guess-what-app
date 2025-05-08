// backend/services/llmService.js

// Import dependencies
const { Anthropic } = require('@anthropic-ai/sdk');
const { LRUCache } = require('lru-cache');
require('dotenv').config();

// Create Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Set up caching with LRU (Least Recently Used) strategy
const responseCache = new LRUCache({
  max: 1000,                           // Store up to 1000 responses
  ttl: 1000 * 60 * 60 * 24 * 7,        // Cache for 7 days (in milliseconds)
  allowStale: false,                    // Don't serve stale items
  updateAgeOnGet: true,                 // Reset TTL when accessed
  updateAgeOnHas: false,
});

/**
 * Call the LLM API with caching
 * @param {string} prompt - The prompt to send to the LLM
 * @param {Object} options - Additional options
 * @param {boolean} options.skipCache - Whether to skip the cache and force a fresh API call
 * @param {number} options.maxTokens - Maximum tokens in the response (default: 1000)
 * @param {number} options.retries - Number of retries on failure (default: 2)
 * @returns {Promise<string>} - The LLM response
 */
async function callLLM(prompt, options = {}) {
  const { 
    skipCache = false, 
    maxTokens = 1000,
    retries = 2
  } = options;
  
  // Create a cache key from the prompt
  const cacheKey = prompt.trim();
  
  // Check cache first (unless skipCache is true)
  if (!skipCache && responseCache.has(cacheKey)) {
    console.log('LLM cache hit');
    return responseCache.get(cacheKey);
  }
  
  console.log('LLM API call');
  
  // Try the API call with retries
  let attempts = 0;
  let lastError = null;
  
  while (attempts <= retries) {
    try {
      const response = await anthropic.messages.create({
        model: process.env.ANTHROPIC_MODEL || "claude-3-haiku-20240307",
        max_tokens: maxTokens,
        messages: [
          { role: "user", content: prompt }
        ]
      });
      
      const result = response.content[0].text;
      
      // Store in cache (unless skipCache is true)
      if (!skipCache) {
        responseCache.set(cacheKey, result);
      }
      
      return result;
    } catch (error) {
      console.error(`LLM API error (attempt ${attempts + 1}/${retries + 1}):`, error.message);
      lastError = error;
      attempts++;
      
      // If we have retries left, wait before trying again
      if (attempts <= retries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempts)); // Exponential backoff
      }
    }
  }
  
  // If we get here, all retries failed
  throw new Error(`LLM API failed after ${retries + 1} attempts: ${lastError.message}`);
}

/**
 * Clear the LLM response cache
 */
function clearCache() {
  responseCache.clear();
  console.log('LLM response cache cleared');
}

// Export the service
module.exports = {
  callLLM,
  clearCache
};