import authService from '../../services/AuthService.js';
import UserStats from '../UserStats.js';
import eventService from '../../services/EventService.js';

/**
 * Component for managing authentication modals
 */
class AuthModal {
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
    eventService.on('auth:login', this.updateAuthState.bind(this));
    eventService.on('auth:logout', this.updateAuthState.bind(this));
    eventService.on('auth:token-expired', (event) => {
      // Handle expired token - close this modal and show login
      if (this.profileModal._isShown) {
        this.profileModal.hide();
        setTimeout(() => this.showLogin(), 300);
      }
    });
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

      if (!result.success) {
        // Special handling for email verification errors
        if (result.isEmailVerificationError) {
          this.loginError.innerHTML = `
      <p>${result.message}</p>
      <button type="button" class="btn btn-sm btn-outline-primary mt-1" id="resend-verification">
        <i class="fas fa-envelope me-1"></i> Resend verification email
      </button>
    `;

          // Add click handler for the resend button
          document.getElementById('resend-verification').addEventListener('click', async () => {
            const emailInput = document.getElementById('login-email');
            const email = emailInput.value.trim();

            if (!email) {
              alert('Please enter your email address first');
              return;
            }

            // Show loading state on the button
            const resendBtn = document.getElementById('resend-verification');
            const originalText = resendBtn.innerHTML;
            resendBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i> Sending...';
            resendBtn.disabled = true;

            // Call the resend function
            const resendResult = await authService.resendVerificationEmail(email);

            // Update button state based on result
            if (resendResult.success) {
              resendBtn.innerHTML = '<i class="fas fa-check me-1"></i> Email sent!';
              resendBtn.classList.replace('btn-outline-primary', 'btn-success');

              // Reset after a few seconds
              setTimeout(() => {
                resendBtn.innerHTML = originalText;
                resendBtn.classList.replace('btn-success', 'btn-outline-primary');
                resendBtn.disabled = false;
              }, 3000);
            } else {
              resendBtn.innerHTML = '<i class="fas fa-exclamation-triangle me-1"></i> Failed to send';
              resendBtn.classList.replace('btn-outline-primary', 'btn-danger');

              // Reset after a few seconds
              setTimeout(() => {
                resendBtn.innerHTML = originalText;
                resendBtn.classList.replace('btn-danger', 'btn-outline-primary');
                resendBtn.disabled = false;
              }, 3000);
            }
          });
        } else {
          this.loginError.textContent = result.message || 'Login failed';
        }

        this.loginError.classList.remove('d-none');
      }
      // Note: On success, the hide/reset is now handled by the auth:login event
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
        // Clear the form fields but don't hide the modal yet
        this.registerForm.style.display = 'none';

        // Create a success message container
        const successMessage = document.createElement('div');
        successMessage.className = 'registration-success text-center py-3';
        successMessage.innerHTML = `
          <div class="mb-4">
            <i class="fas fa-check-circle text-success" style="font-size: 48px;"></i>
          </div>
          <h4>Registration Successful!</h4>
          <p class="mb-4">We've sent a verification email to <strong>${email}</strong>.</p>
          <p>Please check your inbox and click the verification link to activate your account.</p>
          <div class="alert alert-info mt-3 small">
            <i class="fas fa-info-circle me-2"></i>
            If you don't see the email, please check your spam folder.
          </div>
          <button class="btn btn-primary mt-3">Continue to Login</button>
        `;

        // Replace form with success message
        this.registerForm.parentNode.appendChild(successMessage);

        // Add event listener to the "Continue to Login" button
        const continueButton = successMessage.querySelector('button');
        continueButton.addEventListener('click', () => {
          this.registerModal.hide();
          setTimeout(() => this.showLogin(), 400);

          // Clean up - remove success message and restore form for next time
          setTimeout(() => {
            successMessage.remove();
            this.registerForm.style.display = 'block';
            this.registerForm.reset();
          }, 500);
        });
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
      // Note: The modal hide is now handled by the auth:logout event
    });
  }

  /**
   * Update UI based on authentication state
   */
  updateAuthState() {
    const isAuthenticated = authService.isAuthenticated();
    const user = authService.getCurrentUser();

    if (isAuthenticated && user) {
      // If user is logged in and profile modal is shown, update info
      if (this.profileModal._isShown) {
        this.updateProfileInfo(user);
      }
      
      // If login modal is shown, hide it
      if (this.loginModal._isShown) {
        this.loginModal.hide();
        this.loginForm.reset();
      }
    } else {
      // If user is logged out and profile modal is shown, hide it
      if (this.profileModal._isShown) {
        this.profileModal.hide();
      }
    }
  }

  /**
   * Update the profile modal with user information
   */
  async updateProfileInfo(user) {
    try {
      // Show loading state
      const profileContent = document.querySelector('#user-profile-info .profile-content');
      const profileLoading = document.querySelector('#user-profile-info .profile-loading');
      const profileError = document.querySelector('#user-profile-info .profile-error');
      
      // Hide content and error, show loading
      if (profileContent) profileContent.style.display = 'none';
      if (profileError) profileError.style.display = 'none';
      if (profileLoading) profileLoading.style.display = 'block';
      
      const profileResult = await authService.getProfile();
  
      if (profileResult.success && profileResult.profile) {
        const profile = profileResult.profile;
        
        // Update specific elements
        const usernameElement = document.getElementById('profile-username');
        const emailElement = document.getElementById('profile-email');
        
        if (usernameElement) usernameElement.textContent = profile.username;
        if (emailElement) emailElement.textContent = user.email;
        
        // Hide loading, show content
        if (profileLoading) profileLoading.style.display = 'none';
        if (profileContent) profileContent.style.display = 'block';
        
        // Initialize UserStats component
        new UserStats('user-stats');
      } else if (profileResult.error === 'token_expired') {
        // Token expiration is now handled via the event listener
      } else {
        // Show error message
        const errorMessageElement = document.querySelector('#user-profile-info .profile-error .error-message');
        if (errorMessageElement) {
          errorMessageElement.textContent = 'Unable to load profile information';
        }
        
        // Hide loading and content, show error
        if (profileLoading) profileLoading.style.display = 'none';
        if (profileContent) profileContent.style.display = 'none';
        if (profileError) profileError.style.display = 'block';
      }
    } catch (error) {
      console.error('Error updating profile info:', error);
      
      // Show error message
      const errorMessageElement = document.querySelector('#user-profile-info .profile-error .error-message');
      if (errorMessageElement) {
        errorMessageElement.textContent = 'An error occurred while loading your profile';
      }
      
      // Hide loading and content, show error
      const profileContent = document.querySelector('#user-profile-info .profile-content');
      const profileLoading = document.querySelector('#user-profile-info .profile-loading');
      const profileError = document.querySelector('#user-profile-info .profile-error');
      
      if (profileLoading) profileLoading.style.display = 'none';
      if (profileContent) profileContent.style.display = 'none';
      if (profileError) profileError.style.display = 'block';
    }
  }

  /**
   * Show the login modal
   */
  showLogin() {
    // Clear any previous errors
    this.loginError.classList.add('d-none');

    // Add email verification reminder if it doesn't exist yet
    if (!document.getElementById('verification-reminder')) {
      const reminder = document.createElement('div');
      reminder.id = 'verification-reminder';
      reminder.className = 'small text-muted mt-3 text-center';
      reminder.innerHTML = 'Just registered? Please verify your email before logging in.';

      // Find where to insert the reminder (after the form or before the "Don't have an account" text)
      const formEnd = this.loginForm.querySelector('.d-grid') || this.loginForm;
      formEnd.insertAdjacentElement('afterend', reminder);
    }

    this.loginModal.show();
  }

  /**
   * Shows the login modal with an email verification success message
   */
  showLoginWithVerificationSuccess() {
    // First hide any existing modals
    if (this.registerModal._isShown) {
      this.registerModal.hide();
    }
    
    // Clear any previous errors or messages
    this.loginError.classList.add('d-none');
    
    // Create verification success message
    const successMessage = document.createElement('div');
    successMessage.className = 'alert alert-success';
    successMessage.innerHTML = `
      <div class="d-flex align-items-center">
        <i class="fas fa-check-circle text-success me-3" style="font-size: 24px;"></i>
        <div>
          <strong>Email verified successfully!</strong>
          <p class="mb-0">Your account is now active. Please log in below.</p>
        </div>
      </div>
    `;
    
    // Add the success message at the top of the login form
    this.loginForm.insertAdjacentElement('beforebegin', successMessage);
    
    // Show the login modal
    this.loginModal.show();
    
    // Focus on the email input for convenience
    setTimeout(() => {
      document.getElementById('login-email').focus();
    }, 400);
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

export default AuthModal;