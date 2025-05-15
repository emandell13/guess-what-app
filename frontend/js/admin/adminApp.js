// adminApp.js - Main admin application module
import Auth from './modules/auth.js';
import QuestionsManager from './modules/questionManager.js';
import VotingManager from './modules/votingManager.js';
import TextMatchingTester from './modules/textMatchingTester.js';
import SystemOperations from './modules/systemOperations.js';
import SocialImageManager from './modules/socialImageManager.js';

class AdminApp {
    constructor() {
        // Initialize module references
        this.auth = Auth;
        this.questionManager = QuestionsManager;
        this.votingManager = VotingManager;
        this.textMatchingTester = TextMatchingTester;
        this.systemOperations = SystemOperations;
        this.socialImageManager = SocialImageManager;
        
        // Initialize the application
        this.init();
    }
    
    async init() {
        // Check for existing authentication
        const isAuthenticated = await this.auth.checkExistingAuth();
        if (isAuthenticated) {
            this.initializeAuthenticatedUI();
        }
        
        // Set up login form
        this.setupLoginForm();
        
        // Set up UI event handlers
        this.setupUIHandlers();
    }
    
    setupLoginForm() {
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const username = document.getElementById('username').value;
                const password = document.getElementById('password').value;
                
                // Show loading indicator
                const loginError = document.getElementById('login-error');
                loginError.classList.add('d-none');
                
                const submitBtn = loginForm.querySelector('button[type="submit"]');
                const originalBtnText = submitBtn.innerHTML;
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Logging in...';
                
                // Attempt to login
                const success = await this.auth.login(username, password);
                
                if (success) {
                    this.initializeAuthenticatedUI();
                } else {
                    // Show error
                    loginError.textContent = 'Invalid username or password';
                    loginError.classList.remove('d-none');
                    
                    // Reset button
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalBtnText;
                }
            });
        }
    }
    
    async initializeAuthenticatedUI() {
        // Show dashboard, hide login
        document.getElementById('login-container').style.display = 'none';
        document.getElementById('dashboard-container').style.display = 'block';
        
        // Load questions
        await this.questionManager.loadQuestions();
        
        // Setup status filters
        this.questionManager.setupStatusFilters();
        
        // Initialize text matching tester
        this.textMatchingTester.setup();
        
        // Initialize social image manager if the container exists
        const socialImageContainer = document.getElementById('social-image-container');
        if (socialImageContainer) {
            this.socialImageManager.init();
        }
    }
    
    setupUIHandlers() {
        // Add question button
        const saveQuestionBtn = document.getElementById('saveQuestionBtn');
        if (saveQuestionBtn) {
            saveQuestionBtn.addEventListener('click', () => this.questionManager.addQuestion());
        }
        
        // Update question button
        const updateQuestionBtn = document.getElementById('updateQuestionBtn');
        if (updateQuestionBtn) {
            updateQuestionBtn.addEventListener('click', () => this.questionManager.updateQuestion());
        }
        
        // Run daily update button
        const runUpdateBtn = document.getElementById('run-update-btn');
        if (runUpdateBtn) {
            runUpdateBtn.addEventListener('click', () => this.systemOperations.runDailyUpdate());
        }
        
        // Add votes button
        const addVotesBtn = document.getElementById('add-votes-btn');
        if (addVotesBtn) {
            addVotesBtn.addEventListener('click', () => this.votingManager.addVotes());
        }
        
        // Store active tab in session storage
        document.querySelectorAll('#adminTabs .nav-link').forEach(tab => {
            tab.addEventListener('shown.bs.tab', (e) => {
                sessionStorage.setItem('activeAdminTab', e.target.id);
            });
        });
        
        // Restore active tab on page load
        const activeTab = sessionStorage.getItem('activeAdminTab');
        if (activeTab) {
            const tabElement = document.getElementById(activeTab);
            if (tabElement) {
                new bootstrap.Tab(tabElement).show();
            }
        }
    }
}

// Initialize the admin application when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Create and expose the app instance
    window.app = new AdminApp();
});

// Export the app class for potential reuse
export default AdminApp;