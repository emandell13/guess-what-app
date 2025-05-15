// js/admin/modules/socialImageManager.js
import Auth from './auth.js';

class SocialImageManager {
  constructor() {
    this.container = document.getElementById('social-image-container');
    this.loadingIndicator = document.getElementById('social-image-loading');
    this.errorDisplay = document.getElementById('social-image-error');
    this.successDisplay = document.getElementById('social-image-success');
    this.savingIndicator = document.getElementById('social-image-saving');
    this.initialized = false;
  }
  
  async init() {
    // Only initialize once
    if (this.initialized) return;
    
    console.log('Initializing social image manager');
    
    try {
      // Make sure the DOM elements exist
      if (!this.container) {
        console.error('Social image container not found');
        return;
      }
      
      // Show loading
      this.showLoading(true);
      
      // Check if ShareableImage component is available
      if (typeof window.ShareableImage !== 'function') {
        console.error('ShareableImage component not found in window object', window.ShareableImage);
        this.showLoading(false);
        this.showError('ShareableImage component not available. Please refresh the page and try again.');
        return;
      }
      
      console.log('Fetching today\'s data for social image');
      
      // Fetch data with auth using the Auth module
      const response = await Auth.fetchWithAuth('/admin/social-image/today-data');
      
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        let errorMessage;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || `Server returned ${response.status}: ${response.statusText}`;
        } catch (e) {
          errorMessage = `Server returned ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      console.log('Received data:', data);
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch today\'s data');
      }
      
      // Render component
      this.renderComponent(data);
      
      // Hide loading
      this.showLoading(false);
      
      this.initialized = true;
    } catch (error) {
      console.error('Error initializing social image manager:', error);
      this.showError(error.message || 'Failed to initialize social image generator');
      this.showLoading(false);
    }
  }
  
  renderComponent(data) {
    console.log('Rendering ShareableImage component with data:', data);
    
    // Clear container
    this.container.innerHTML = '';
    
    // Create component container
    const componentContainer = document.createElement('div');
    this.container.appendChild(componentContainer);
    
    // Format the data for the ShareableImage component
    const props = {
      // Use guessPrompt as the question text (includes "their favorite food" or similar)
      question: data.guessPrompt || "today's question",
      
      // Use the actual question text as a reference (for debugging)
      questionText: data.question,
      
      // Use the total votes count
      totalVotes: data.totalVotes || 0,
      
      // Use the date provided by the backend
      date: data.date,
      
      // Use the actual answers with vote counts
      answers: data.answers || [],
      
      // Provide the callback for image generation
      onImageGenerated: this.handleImageGenerated.bind(this)
    };
    
    console.log('Rendering with props:', props);
    
    try {
      // Render component
      ReactDOM.render(
        React.createElement(window.ShareableImage, props),
        componentContainer
      );
      console.log('Component rendered successfully');
    } catch (error) {
      console.error('Error rendering component:', error);
      this.showError('Error rendering component: ' + error.message);
    }
  }
  
  async handleImageGenerated(imageBlob, imageUrl) {
    try {
      // Show saving indicator
      this.showSaving(true);
      
      // Create form data
      const formData = new FormData();
      formData.append('image', imageBlob, 'social-image.png');
      
      // Get auth credentials
      const authCredentials = Auth.getCredentials();
      
      if (!authCredentials) {
        throw new Error('Not authenticated. Please try logging in again.');
      }
      
      // Upload the image with auth
      const response = await fetch('/admin/social-image/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${authCredentials}`
        },
        body: formData
      });
      
      if (!response.ok) {
        let errorMessage;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || `Server returned ${response.status}: ${response.statusText}`;
        } catch (e) {
          errorMessage = `Server returned ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to upload image');
      }
      
      // Show success message
      this.showSuccess(`Image uploaded successfully! <a href="${data.publicUrl}" target="_blank">View Image</a>`);
      
      // Hide saving indicator
      this.showSaving(false);
    } catch (error) {
      console.error('Error handling generated image:', error);
      this.showError(error.message || 'Failed to upload image');
      this.showSaving(false);
    }
  }
  
  showLoading(isLoading) {
    if (this.loadingIndicator) {
      this.loadingIndicator.style.display = isLoading ? 'block' : 'none';
    }
  }
  
  showSaving(isSaving) {
    if (this.savingIndicator) {
      this.savingIndicator.style.display = isSaving ? 'block' : 'none';
    }
  }
  
  showError(message) {
    if (this.errorDisplay) {
      this.errorDisplay.textContent = message;
      this.errorDisplay.style.display = 'block';
      
      // Hide after some time
      setTimeout(() => {
        this.errorDisplay.style.display = 'none';
      }, 8000);
    }
  }
  
  showSuccess(message) {
    if (this.successDisplay) {
      this.successDisplay.innerHTML = message;
      this.successDisplay.style.display = 'block';
      
      // Hide after some time
      setTimeout(() => {
        this.successDisplay.style.display = 'none';
      }, 8000);
    }
  }
}

// Create and export singleton instance
const instance = new SocialImageManager();
export default instance;