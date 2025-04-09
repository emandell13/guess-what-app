require('dotenv').config();
const gifService = require('../services/gifService');
const path = require('path');
const fs = require('fs');

async function testGifGeneration() {
  try {
    console.log('Starting test GIF generation...');
    
    // Get base URL from environment or use localhost
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const templateUrl = `${baseUrl}/social-share.html`;
    
    console.log('Using template URL:', templateUrl);
    
    // Generate the GIF
    const gifPath = await gifService.generateGif(templateUrl);
    
    if (!gifPath) {
      throw new Error('Failed to generate GIF');
    }
    
    console.log('GIF generated successfully!');
    console.log('GIF available at:', gifPath);
    
    // Get the absolute path to the GIF
    const absoluteGifPath = path.join(__dirname, '../../frontend', gifPath);
    
    // Check if the GIF file exists
    if (fs.existsSync(absoluteGifPath)) {
      const stats = fs.statSync(absoluteGifPath);
      console.log(`GIF file size: ${(stats.size / (1024 * 1024)).toFixed(2)} MB`);
      console.log(`You can view this GIF at: ${baseUrl}${gifPath}`);
    } else {
      console.error('GIF file was not found at the expected location!');
    }
    
  } catch (error) {
    console.error('Error generating test GIF:', error);
  }
}

// Run the test
testGifGeneration();