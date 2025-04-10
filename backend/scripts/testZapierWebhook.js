// testZapierWebhook.js
const axios = require('axios');
require('dotenv').config();

async function testZapierWebhook() {
  try {
    const webhookUrl = process.env.ZAPIER_WEBHOOK_URL
    
    // Create test data that mimics what your actual service will send
    const testData = {
      gifUrl: 'https://example.com/sample.gif', // Sample GIF URL
      staticImageUrl: 'https://qsauryodpxufvhncpomm.supabase.co/storage/v1/object/public/social-assets/still_1744312060374.jpg', // Sample static image URL
      caption: 'This is a test caption for Instagram',
      timestamp: new Date().toISOString()
    };
    
    console.log('Sending test data to Zapier webhook...');
    
    // Send the POST request to the webhook
    const response = await axios.post(webhookUrl, testData);
    
    console.log('Response:', response.status, response.statusText);
    console.log('Test completed successfully!');
  } catch (error) {
    console.error('Error sending test to webhook:', error.message);
  }
}

// Run the test
testZapierWebhook();