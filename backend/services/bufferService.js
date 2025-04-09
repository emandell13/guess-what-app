// backend/services/bufferService.js
const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const path = require('path');

/**
 * Service for integrating with Buffer API
 */
const bufferService = {
  /**
   * Upload a video to Buffer and schedule it
   * @param {string} videoPath - Path to the video file
   * @param {string} caption - Caption for the post
   * @param {string} scheduledAt - ISO timestamp for scheduling (optional)
   * @returns {Promise<Object>} - Buffer API response
   */
  async scheduleReel(videoPath, caption, scheduledAt = null) {
    try {
      const bufferAccessToken = process.env.BUFFER_ACCESS_TOKEN;
      
      if (!bufferAccessToken) {
        throw new Error('Missing Buffer API access token');
      }
      
      // Full path to the video file
      const fullVideoPath = path.join(__dirname, '../../frontend', videoPath);
      
      // Create form data for the media upload
      const formData = new FormData();
      formData.append('media', fs.createReadStream(fullVideoPath));
      
      // First upload the media to Buffer
      const uploadResponse = await axios.post(
        'https://api.bufferapp.com/1/media/upload.json',
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            'Authorization': `Bearer ${bufferAccessToken}`
          }
        }
      );
      
      if (!uploadResponse.data.success) {
        throw new Error('Failed to upload media to Buffer');
      }
      
      // Get the Instagram profile ID
      const profilesResponse = await axios.get(
        'https://api.bufferapp.com/1/profiles.json',
        {
          headers: {
            'Authorization': `Bearer ${bufferAccessToken}`
          }
        }
      );
      
      // Find the Instagram profile
      const instagramProfile = profilesResponse.data.find(
        profile => profile.service === 'instagram'
      );
      
      if (!instagramProfile) {
        throw new Error('No Instagram profile found in Buffer account');
      }
      
      // Prepare the update
      const updateData = {
        profile_ids: [instagramProfile.id],
        text: caption,
        media: {
          media_id: uploadResponse.data.media_id
        }
      };
      
      // Add scheduling if provided
      if (scheduledAt) {
        updateData.scheduled_at = scheduledAt;
      }
      
      // Create the update in Buffer
      const createResponse = await axios.post(
        'https://api.bufferapp.com/1/updates/create.json',
        updateData,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${bufferAccessToken}`
          }
        }
      );
      
      return {
        success: true,
        data: createResponse.data
      };
    } catch (error) {
      console.error('Buffer API error:', error);
      return {
        success: false,
        error: error.message || 'Failed to schedule post on Buffer'
      };
    }
  }
};

module.exports = bufferService;