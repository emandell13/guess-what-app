// Create new file: backend/services/zapierService.js
const axios = require('axios');

/**
 * Service for posting to Instagram via Zapier webhook
 */
const zapierService = {
  /**
   * Send GIF data to Zapier webhook for Instagram posting
   * @param {string} gifUrl - Public URL to the GIF in Supabase
   * @param {string} caption - Caption for the Instagram post
   * @returns {Promise<Object>} - Result of the API call
   */
  async postToInstagram(gifUrl, staticImageUrl, caption) {
    try {
      const webhookUrl = process.env.ZAPIER_WEBHOOK_URL;
      
      if (!webhookUrl) {
        throw new Error('Missing Zapier webhook URL');
      }
      
      // Prepare data for Zapier
      const postData = {
        gifUrl: gifUrl,
        imageUrl: staticImageUrl, // Use this for Instagram
        caption: caption,
        timestamp: new Date().toISOString()
      };
      
      // Send to Zapier webhook
      const response = await axios.post(webhookUrl, postData);
      
      console.log('Successfully sent to Zapier webhook');
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Error sending to Zapier:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
};

module.exports = zapierService;