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
 * @param {string} options.model - Override the model for this call. Defaults
 *   to ANTHROPIC_MODEL env var (set app-wide to Haiku 4.5). Pass a Sonnet ID
 *   for calls that need more nuance (e.g. the daily host quip).
 * @returns {Promise<string>} - The LLM response
 */
async function callLLM(prompt, options = {}) {
  const {
    skipCache = false,
    maxTokens = 1000,
    retries = 2,
    model
  } = options;

  const resolvedModel = model || process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001";

  // Cache key includes the model so a Sonnet response doesn't serve a Haiku
  // cache hit (and vice-versa).
  const cacheKey = `${resolvedModel}::${prompt.trim()}`;

  // Check cache first (unless skipCache is true)
  if (!skipCache && responseCache.has(cacheKey)) {
    console.log('LLM cache hit');
    return responseCache.get(cacheKey);
  }

  console.log(`LLM API call (${resolvedModel})`);

  // Try the API call with retries
  let attempts = 0;
  let lastError = null;

  while (attempts <= retries) {
    try {
      const response = await anthropic.messages.create({
        model: resolvedModel,
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