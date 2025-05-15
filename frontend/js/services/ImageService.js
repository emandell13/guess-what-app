// frontend/js/services/ImageService.js

import authService from './AuthService.js';

/**
 * Service for handling social media image generation and upload
 */
class ImageService {
  /**
   * Uploads an image to Supabase storage
   * @param {Blob} imageBlob - The image blob to upload
   * @param {string} fileName - Optional custom filename
   * @returns {Promise<Object>} Upload result
   */
  async uploadImage(imageBlob, fileName = null) {
    try {
      // Create a FormData object to send the image
      const formData = new FormData();
      formData.append('image', imageBlob);
      
      // Add custom filename if provided
      if (fileName) {
        formData.append('fileName', fileName);
      }
      
      // Get auth headers if user is authenticated
      const headers = {};
      if (authService.isAuthenticated()) {
        headers['Authorization'] = `Bearer ${authService.token}`;
      }
      
      // Upload the image to the backend
      const response = await fetch('/api/upload-social-image', {
        method: 'POST',
        headers,
        body: formData
      });
      
      if (!response.ok) {
        throw new Error('Failed to upload image');
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error uploading image:', error);
      return {
        success: false,
        error: error.message || 'Failed to upload image'
      };
    }
  }
  
  /**
   * Gets today's data for the social image
   * @returns {Promise<Object>} The data for the social image
   */
  async getTodayData() {
    try {
      const response = await fetch('/api/today-data');
      
      if (!response.ok) {
        throw new Error('Failed to fetch today\'s data');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching today\'s data:', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch today\'s data'
      };
    }
  }
  
  /**
   * Generates and uploads today's social image
   * @returns {Promise<Object>} The result with image URL
   */
  async generateAndUploadTodayImage() {
    try {
      // Get today's data
      const data = await this.getTodayData();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to get today\'s data');
      }
      
      // Return the generated image URL
      return {
        success: true,
        message: 'Image will be generated in the UI and uploaded via callback'
      };
    } catch (error) {
      console.error('Error generating today\'s image:', error);
      return {
        success: false,
        error: error.message || 'Failed to generate today\'s image'
      };
    }
  }
}

// Create a singleton instance
const imageService = new ImageService();
export default imageService;