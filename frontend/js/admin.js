// Global variables
let currentQuestionId = null;
let authCredentials = null;
const addQuestionModal = new bootstrap.Modal(document.getElementById('addQuestionModal'));
const editQuestionModal = new bootstrap.Modal(document.getElementById('editQuestionModal'));

// Authentication functions
function setAuthCredentials(username, password) {
    authCredentials = btoa(`${username}:${password}`);
    // Store credentials in session storage (cleared when browser closes)
    sessionStorage.setItem('adminAuth', authCredentials);
}

function getAuthCredentials() {
    // Try to get from memory first, then session storage
    return authCredentials || sessionStorage.getItem('adminAuth');
}

// Fetch with authentication
async function fetchWithAuth(url, options = {}) {
    const credentials = getAuthCredentials();
    
    if (!credentials) {
        throw new Error('Not authenticated');
    }
    
    return fetch(url, {
        ...options,
        headers: {
            ...options.headers,
            'Authorization': `Basic ${credentials}`,
            'Content-Type': options.body ? 'application/json' : undefined,
            ...options.headers
        }
    });
}

// Login function
async function login(username, password) {
    try {
        // Set credentials
        setAuthCredentials(username, password);
        
        // Test auth with a simple request
        const response = await fetchWithAuth('/admin/questions');
        
        if (response.ok) {
            // Show dashboard, hide login
            document.getElementById('login-container').style.display = 'none';
            document.getElementById('dashboard-container').style.display = 'block';
            
            // Load questions
            loadQuestions();
        } else {
            // Show error
            const errorDiv = document.getElementById('login-error');
            errorDiv.textContent = 'Invalid username or password';
            errorDiv.classList.remove('d-none');
            
            // Clear credentials
            authCredentials = null;
            sessionStorage.removeItem('adminAuth');
        }
    } catch (error) {
        console.error('Login error:', error);
        const errorDiv = document.getElementById('login-error');
        errorDiv.textContent = 'Login failed. Please try again.';
        errorDiv.classList.remove('d-none');
    }
}

// Format date in ET timezone
function formatDate(dateString) {
    // Create date in ET timezone
    const etDate = new Date(dateString + 'T00:00:00-05:00');
    return etDate.toLocaleDateString('en-US', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

// Load all questions
async function loadQuestions() {
    try {
        const response = await fetchWithAuth('/admin/questions');
        
        if (!response.ok) {
            throw new Error('Failed to fetch questions');
        }
        
        const data = await response.json();
        const questionsList = document.getElementById('questionsList');
        
        if (data.questions && data.questions.length > 0) {
            questionsList.innerHTML = data.questions.map(question => `
                <a href="#" class="list-group-item list-group-item-action d-flex justify-content-between align-items-center" 
                   data-id="${question.id}" onclick="loadQuestionDetails('${question.id}'); return false;">
                    <div>
                        <div class="fw-bold">${escapeHtml(question.question_text)}</div>
                        <small class="text-muted">Active Date: ${formatDate(question.active_date)}</small>
                    </div>
                    <span class="badge ${question.voting_complete ? 'bg-success' : 'bg-warning'} rounded-pill">
                        ${question.voting_complete ? 'Complete' : 'Voting'}
                    </span>
                </a>
            `).join('');
        } else {
            questionsList.innerHTML = '<div class="list-group-item text-center py-3">No questions found</div>';
        }
    } catch (error) {
        console.error('Error loading questions:', error);
        document.getElementById('questionsList').innerHTML = 
            '<div class="list-group-item text-danger text-center">Failed to load questions</div>';
    }
}

// Load question details
async function loadQuestionDetails(id) {
    currentQuestionId = id;
    
    // Highlight selected question
    document.querySelectorAll('#questionsList a').forEach(el => {
        el.classList.remove('active');
        if (el.dataset.id === id) {
            el.classList.add('active');
        }
    });
    
    try {
        const response = await fetchWithAuth(`/admin/questions/${id}`);
        
        if (!response.ok) {
            throw new Error('Failed to fetch question details');
        }
        
        const data = await response.json();
        const detailsContainer = document.getElementById('questionDetails');
        
        if (data.question) {
            const votingComplete = data.question.voting_complete;
            
            detailsContainer.innerHTML = `
                <div class="mb-4">
                    <h3>${escapeHtml(data.question.question_text)}</h3>
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <div><strong>Active Date:</strong> ${formatDate(data.question.active_date)}</div>
                        <div class="badge ${votingComplete ? 'bg-success' : 'bg-warning'} rounded-pill">
                            ${votingComplete ? 'Complete' : 'Voting'}
                        </div>
                    </div>
                    <div class="mb-3"><strong>Votes received:</strong> ${data.voteCount}</div>
                    
                    <div class="action-buttons">
                        ${!votingComplete ? `
                            <button class="btn btn-primary" onclick="tallyVotes('${id}')">
                                <i class="fas fa-calculator me-2"></i>Tally Votes
                            </button>
                        ` : ''}
                        
                        <button class="btn btn-outline-secondary" onclick="showEditModal('${id}')">
                            <i class="fas fa-edit me-1"></i> Edit
                        </button>
                        <button class="btn btn-outline-danger" onclick="deleteQuestion('${id}')">
                            <i class="fas fa-trash me-1"></i> Delete
                        </button>
                    </div>
                </div>
                
                ${votingComplete ? `
                    <h4 class="mb-3">Top Answers</h4>
                    <div class="list-group mb-4">
                        ${data.topAnswers.length ? data.topAnswers.map(answer => `
                            <div class="list-group-item d-flex justify-content-between align-items-center">
                                <div>
                                    <span class="badge bg-primary rounded-pill me-2">#${answer.rank}</span>
                                    ${escapeHtml(answer.answer)}
                                </div>
                                <span class="badge bg-secondary rounded-pill">${answer.vote_count} votes</span>
                            </div>
                        `).join('') : '<div class="list-group-item text-center">No answers available</div>'}
                    </div>
                ` : `
                    <h4 class="mb-3">Status</h4>
                    <div class="alert alert-info">
                        <i class="fas fa-info-circle me-2"></i>
                        Voting in progress. ${data.voteCount} votes collected.
                    </div>
                `}
            `;
        } else {
            detailsContainer.innerHTML = '<div class="alert alert-danger">Failed to load question details</div>';
        }
    } catch (error) {
        console.error('Error loading question details:', error);
        document.getElementById('questionDetails').innerHTML = 
            '<div class="alert alert-danger">Failed to load question details</div>';
    }
}

// Show edit modal
function showEditModal(id) {
    fetchWithAuth(`/admin/questions/${id}`)
        .then(response => response.json())
        .then(data => {
            if (data.question) {
                document.getElementById('editQuestionId').value = data.question.id;
                document.getElementById('editQuestionText').value = data.question.question_text;
                document.getElementById('editGuessPrompt').value = data.question.guess_prompt || '';
                document.getElementById('editActiveDate').value = data.question.active_date.split('T')[0];
                document.getElementById('editVotingComplete').checked = data.question.voting_complete;
                
                editQuestionModal.show();
            }
        })
        .catch(error => {
            console.error('Error fetching question for edit:', error);
            alert('Failed to load question for editing');
        });
}

// Update question
async function updateQuestion() {
    const id = document.getElementById('editQuestionId').value;
    const questionText = document.getElementById('editQuestionText').value.trim();
    const guessPrompt = document.getElementById('editGuessPrompt').value.trim();
    const activeDate = document.getElementById('editActiveDate').value;
    const votingComplete = document.getElementById('editVotingComplete').checked;
    
    if (!questionText || !activeDate || !guessPrompt) {
        alert('Please fill in all fields');
        return;
    }
    
    try {
        const response = await fetchWithAuth(`/admin/questions/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ 
                question_text: questionText, 
                guess_prompt: guessPrompt,
                active_date: activeDate,
                voting_complete: votingComplete
            }),
        });
        
        if (!response.ok) {
            throw new Error('Failed to update question');
        }
        
        editQuestionModal.hide();
        loadQuestions();
        loadQuestionDetails(id);
        
    } catch (error) {
        console.error('Error updating question:', error);
        alert('Failed to update question');
    }
}

// Add new question
async function addQuestion() {
    const questionText = document.getElementById('questionText').value.trim();
    const guessPrompt = document.getElementById('guessPrompt').value.trim();
    const activeDate = document.getElementById('activeDate').value;
    
    if (!questionText || !activeDate) {
        alert('Please fill in all fields');
        return;
    }
    
    try {
        const response = await fetchWithAuth('/admin/questions', {
            method: 'POST',
            body: JSON.stringify({ 
                question_text: questionText,
                guess_prompt: guessPrompt,
                active_date: activeDate 
            }),
        });
        
        if (!response.ok) {
            throw new Error('Failed to add question');
        }
        
        const data = await response.json();
        
        addQuestionModal.hide();
        document.getElementById('addQuestionForm').reset();
        loadQuestions();
        
        // Load the new question details if available
        if (data.question && data.question.id) {
            loadQuestionDetails(data.question.id);
        }
        
    } catch (error) {
        console.error('Error adding question:', error);
        alert('Failed to add question');
    }
}

// Tally votes for a question
async function tallyVotes(id) {
    if (!confirm('Are you sure you want to tally votes? This will finalize the top answers for this question.')) {
        return;
    }
    
    try {
        const response = await fetchWithAuth(`/admin/tally/${id}`, {
            method: 'POST',
            // Optionally pass a parameter to specify we want top 10
            body: JSON.stringify({ 
                answerCount: 10 // Store top 10 answers
            }),
        });
        
        if (!response.ok) {
            throw new Error('Failed to tally votes');
        }
        
        alert('Votes tallied successfully!');
        loadQuestions();
        loadQuestionDetails(id);
        
    } catch (error) {
        console.error('Error tallying votes:', error);
        alert('Failed to tally votes');
    }
}

// Delete a question
async function deleteQuestion(id) {
    if (!confirm('Are you sure you want to delete this question? This cannot be undone.')) {
        return;
    }
    
    try {
        const response = await fetchWithAuth(`/admin/questions/${id}`, {
            method: 'DELETE',
        });
        
        if (!response.ok) {
            throw new Error('Failed to delete question');
        }
        
        alert('Question deleted successfully!');
        loadQuestions();
        document.getElementById('questionDetails').innerHTML = 
            '<p class="text-center text-muted my-4">Select a question to view details</p>';
        
    } catch (error) {
        console.error('Error deleting question:', error);
        alert('Failed to delete question');
    }
}

// Helper function to escape HTML to prevent XSS
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Check if user is already logged in
function checkExistingAuth() {
    if (getAuthCredentials()) {
        // Try to verify credentials
        fetchWithAuth('/admin/questions')
            .then(response => {
                if (response.ok) {
                    // Show dashboard, hide login
                    document.getElementById('login-container').style.display = 'none';
                    document.getElementById('dashboard-container').style.display = 'block';
                    loadQuestions();
                }
            })
            .catch(() => {
                // If verification fails, show login
                sessionStorage.removeItem('adminAuth');
            });
    }
}

// Function to manually trigger daily update
async function runDailyUpdate() {
    try {
        // Show loading state via alert
        alert('Starting daily update - this may take a moment...');
        
        // Call the update endpoint with authentication
        const response = await fetchWithAuth('/admin/run-update');
        const result = await response.json();
        
        // Show result
        if (result.success) {
            alert(`Update completed successfully!\n\nMessage: ${result.message}`);
        } else {
            alert(`Update failed.\n\nError: ${result.error || 'Unknown error'}`);
        }
    } catch (error) {
        console.error('Error running update:', error);
        alert(`Failed to run update: ${error.message}`);
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Setup event listeners
    document.getElementById('login-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        login(username, password);
    });
    
    document.getElementById('saveQuestionBtn').addEventListener('click', addQuestion);
    document.getElementById('updateQuestionBtn').addEventListener('click', updateQuestion);
    const updateBtn = document.getElementById('run-update-btn');
    if (updateBtn) {
        updateBtn.addEventListener('click', runDailyUpdate);
    }
    
    // Check for existing auth
    checkExistingAuth();
    
    // Expose functions needed by inline onclick handlers
    window.loadQuestionDetails = loadQuestionDetails;
    window.showEditModal = showEditModal;
    window.tallyVotes = tallyVotes;
    window.deleteQuestion = deleteQuestion;
    window.runDailyUpdate = runDailyUpdate;
});