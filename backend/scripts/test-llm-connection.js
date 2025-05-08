// test-llm-connection.js

// Load environment variables
require('dotenv').config();

// Choose the appropriate client based on your selection
const { Anthropic } = require('@anthropic-ai/sdk');
// or
// const OpenAI = require('openai');

async function testConnection() {
  try {
    // For Anthropic:
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
    
    const response = await anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL,
      max_tokens: 100,
      messages: [
        { role: "user", content: "Hello, are you working properly?" }
      ]
    });
    
    console.log("Connection successful!");
    console.log("Response:", response.content[0].text);
    
    // For OpenAI:
    /*
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL,
      max_tokens: 100,
      messages: [
        { role: "user", content: "Hello, are you working properly?" }
      ]
    });
    
    console.log("Connection successful!");
    console.log("Response:", response.choices[0].message.content);
    */
    
  } catch (error) {
    console.error("API connection error:", error);
  }
}

testConnection();