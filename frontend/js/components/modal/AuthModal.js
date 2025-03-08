import authService from '../../services/AuthService.js';

/**
 * Component for managing authentication modals
 */
class AuthModals {
  constructor() {
    // Get modal elements
    this.loginModal = new bootstrap.Modal(document.getElementById('loginModal'));
    this.registerModal = new bootstrap.Modal(document.getElementById('registerModal'));
    this.profileModal = new bootstrap.Modal(document.getElementById('userProfileModal'));
    
    // Get form elements
    this.loginForm = document.getElementById('login-form');
    this.registerForm = document.getElementById('register-form');
    this.loginError = document.getElementById('login-error');
    this.registerError = document.getElementById('register-error');
    this.userProfileInfo = document.getElementById('user-profile-info');
    
    // Setup event listeners
    this.setupEventListeners();
    this.updateAuthState();
    
    // Subscribe to auth events
    document.addEventListener('user-login', this.updateAuthState.bind(this));
    document.addEventListener('user-logout', this.updateAuthState.bind(this));
  }
  
  /**
   * Set up event listeners for forms and buttons
   */
  setupEventListeners() {
    // Login form submission
    this.loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const email = document.getElementById('login-email').value;
      const password = document.getElementById('login-password').value;
      
      this.loginError.classList.add('d-none');
      
      const result = await authService.login(email, password);
      
      if (result.success) {
        this.loginModal.hide();
        this.loginForm.reset();
      } else {
        this.loginError.textContent = result.message || 'Login failed';
        this.loginError.classList.remove('d-none');
      }
    });
    
    // Register form submission
    this.registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const username = document.getElementById('register-username').value;
      const email = document.getElementById('register-email').value;
      const password = document.getElementById('register-password').value;
      
      this.registerError.classList.add('d-none');
      
      if (password.length < 8) {
        this.registerError.textContent = 'Password must be at least 8 characters long';
        this.registerError.classList.remove('d-none');
        return;
      }
      
      const result = await authService.register(email, password, username);
      
      if (result.success) {
        this.registerModal.hide();
        this.registerForm.reset();
        
        // Show success message and switch to login
        alert('Registration successful! Please log in with your new account.');
        setTimeout(() => this.showLogin(), 500);
      } else {
        this.registerError.textContent = result.message || 'Registration failed';
        this.registerError.classList.remove('d-none');
      }
    });
    
    // Switch between login and register
    document.getElementById('switch-to-register').addEventListener('click', (e) => {
      e.preventDefault();
      this.loginModal.hide();
      setTimeout(() => this.showRegister(), 400);
    });
    
    document.getElementById('switch-to-login').addEventListener('click', (e) => {
      e.preventDefault();
      this.registerModal.hide();
      setTimeout(() => this.showLogin(), 400);
    });
    
    // Logout button
    document.getElementById('logout-button').addEventListener('click', async () => {
      await authService.logout();
      this.profileModal.hide();
    });
  }
  
  /**
   * Update UI based on authentication state
   */
  updateAuthState() {
    const isAuthenticated = authService.isAuthenticated();
    const user = authService.getCurrentUser();
    
    if (isAuthenticated && user) {
      this.updateProfileInfo(user);
    }
  }
  
  /**
   * Update the profile modal with user information
   */
  async updateProfileInfo(user) {
    try {
      const profileResult = await authService.getProfile();
      
      if (profileResult.success && profileResult.profile) {
        const profile = profileResult.profile;
        
        this.userProfileInfo.innerHTML = `
          <div class="text-center mb-4">
            <h4>${profile.username}</h4>
            <p class="text-muted">${user.email}</p>
          </div>
          <div class="mb-3">
            <h5>Your Stats</h5>
            <div id="user-stats">
              <!-- Stats will be loaded from UserStats component -->
              <p><em>Loading your statistics...</em></p>
            </div>
          </div>
        `;
      } else {
        this.userProfileInfo.innerHTML = `
          <div class="alert alert-warning">
            Failed to load profile information
          </div>
        `;
      }
    } catch (error) {
      console.error('Error updating profile info:', error);
      this.userProfileInfo.innerHTML = `
        <div class="alert alert-danger">
          An error occurred while loading your profile
        </div>
      `;
    }
  }
  
  /**
   * Show the login modal
   */
  showLogin() {
    // Clear any previous errors
    this.loginError.classList.add('d-none');
    this.loginModal.show();
  }
  
  /**
   * Show the registration modal
   */
  showRegister() {
    // Clear any previous errors
    this.registerError.classList.add('d-none');
    this.registerModal.show();
  }
  
  /**
   * Show the user profile modal
   */
  showProfile() {
    if (authService.isAuthenticated()) {
      this.profileModal.show();
      this.updateProfileInfo(authService.getCurrentUser());
    } else {
      this.showLogin();
    }
  }
}

export default AuthModals;