// testGifGeneration.js
require('dotenv').config();
const gifService = require('../services/gifService');
const path = require('path');

async function testGifGeneration() {
  try {
    console.log('Starting test GIF and static image generation...');
    
    // Get base URL from environment or use localhost
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const templateUrl = `${baseUrl}/social-share.html`;
    
    console.log('Using template URL:', templateUrl);
    
    // Generate the GIF and static image
    const result = await gifService.generateGifAndStillImage(templateUrl);
    
    if (!result || !result.gifUrl || !result.staticImageUrl) {
      throw new Error('Failed to generate media');
    }
    
    console.log('Media generated successfully!');
    console.log('GIF URL:', result.gifUrl);
    console.log('Static Image URL:', result.staticImageUrl);
    
    console.log('\nYou can test your Zapier webhook with these URLs.');
    console.log('For example, update your testZapierWebhook.js with:');
    console.log(`\ngifUrl: '${result.gifUrl}',`);
    console.log(`staticImageUrl: '${result.staticImageUrl}',`);
    
    return result;
  } catch (error) {
    console.error('Error generating test media:', error);
  }
}

// Run the test
testGifGeneration();