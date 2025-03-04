// Global variables
let currentQuestionId = null;
let authCredentials = null;
const addQuestionModal = new bootstrap.Modal(document.getElementById('addQuestionModal'));
const editQuestionModal = new bootstrap.Modal(document.getElementById('editQuestionModal'));

// =================================
// Authentication Module
// =================================
const Auth = {
    setCredentials: function(username, password) {
        authCredentials = btoa(`${username}:${password}`);
        // Store credentials in session storage (cleared when browser closes)
        sessionStorage.setItem('adminAuth', authCredentials);
    },

    getCredentials: function() {
        // Try to get from memory first, then session storage
        return authCredentials || sessionStorage.getItem('adminAuth');
    },

    clearCredentials: function() {
        authCredentials = null;
        sessionStorage.removeItem('adminAuth');
    },

    fetchWithAuth: async function(url, options = {}) {
        const credentials = this.getCredentials();
        
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
    },

    login: async function(username, password) {
        try {
            // Set credentials
            this.setCredentials(username, password);
            
            // Test auth with a simple request
            const response = await this.fetchWithAuth('/admin/questions');
            
            if (response.ok) {
                // Show dashboard, hide login
                document.getElementById('login-container').style.display = 'none';
                document.getElementById('dashboard-container').style.display = 'block';
                
                // Load questions
                QuestionsManager.loadQuestions();
            } else {
                // Show error
                const errorDiv = document.getElementById('login-error');
                errorDiv.textContent = 'Invalid username or password';
                errorDiv.classList.remove('d-none');
                
                // Clear credentials
                this.clearCredentials();
            }
        } catch (error) {
            console.error('Login error:', error);
            const errorDiv = document.getElementById('login-error');
            errorDiv.textContent = 'Login failed. Please try again.';
            errorDiv.classList.remove('d-none');
        }
    },

    checkExistingAuth: function() {
        if (this.getCredentials()) {
            // Try to verify credentials
            this.fetchWithAuth('/admin/questions')
                .then(response => {
                    if (response.ok) {
                        // Show dashboard, hide login
                        document.getElementById('login-container').style.display = 'none';
                        document.getElementById('dashboard-container').style.display = 'block';
                        QuestionsManager.loadQuestions();
                    }
                })
                .catch(() => {
                    // If verification fails, show login
                    this.clearCredentials();
                });
        }
    }
};

// =================================
// Questions Manager Module
// =================================
const QuestionsManager = {
    formatDate: function(dateString) {
        // Create date in ET timezone
        const etDate = new Date(dateString + 'T00:00:00-05:00');
        return etDate.toLocaleDateString('en-US', {
            timeZone: 'America/New_York',
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    },
    
    escapeHtml: function(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    },

    loadQuestions: async function() {
        try {
            const response = await Auth.fetchWithAuth('/admin/questions');
            
            if (!response.ok) {
                throw new Error('Failed to fetch questions');
            }
            
            const data = await response.json();
            const questionsList = document.getElementById('questionsList');
            
            if (data.questions && data.questions.length > 0) {
                questionsList.innerHTML = data.questions.map(question => `
                    <a href="#" class="list-group-item list-group-item-action d-flex justify-content-between align-items-center" 
                       data-id="${question.id}" onclick="QuestionsManager.loadQuestionDetails('${question.id}'); return false;">
                        <div>
                            <div class="fw-bold">${this.escapeHtml(question.question_text)}</div>
                            <small class="text-muted">Active Date: ${this.formatDate(question.active_date)}</small>
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
    },

    loadQuestionDetails: async function(id) {
        currentQuestionId = id;
        
        // Highlight selected question
        document.querySelectorAll('#questionsList a').forEach(el => {
            el.classList.remove('active');
            if (el.dataset.id === id) {
                el.classList.add('active');
            }
        });
        
        try {
            const response = await Auth.fetchWithAuth(`/admin/questions/${id}`);
            
            if (!response.ok) {
                throw new Error('Failed to fetch question details');
            }
            
            const data = await response.json();
            
            if (data.question) {
                // Update basic question info
                this.updateQuestionInfo(data.question, data.voteCount);
                
                // Update/show top answers if available
                if (data.question.voting_complete && data.topAnswers) {
                    this.showTopAnswers(data.topAnswers);
                } else {
                    document.getElementById('top-answers-section').style.display = 'none';
                }
                
                // Update vote distribution if available
                if (data.voteDistribution && data.voteDistribution.length > 0) {
                    VotingManager.showVoteDistribution(data.voteDistribution, data.voteCount);
                } else {
                    document.getElementById('vote-distribution-section').style.display = 'none';
                }
                
                // Update add votes form
                VotingManager.showAddVotesForm(id);
            } else {
                document.getElementById('questionDetails').innerHTML = 
                    '<div class="alert alert-danger">Failed to load question details</div>';
            }
        } catch (error) {
            console.error('Error loading question details:', error);
            document.getElementById('questionDetails').innerHTML = 
                '<div class="alert alert-danger">Failed to load question details</div>';
        }
    },

    updateQuestionInfo: function(question, voteCount) {
        const detailsContainer = document.getElementById('questionDetails');
        const votingComplete = question.voting_complete;
        
        detailsContainer.innerHTML = `
            <div class="mb-4">
                <h3>${this.escapeHtml(question.question_text)}</h3>
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <div><strong>Active Date:</strong> ${this.formatDate(question.active_date)}</div>
                    <div class="badge ${votingComplete ? 'bg-success' : 'bg-warning'} rounded-pill">
                        ${votingComplete ? 'Complete' : 'Voting'}
                    </div>
                </div>
                <div class="mb-3"><strong>Votes received:</strong> ${voteCount}</div>
                
                <div class="action-buttons">
                    ${!votingComplete ? `
                        <button class="btn btn-primary" onclick="QuestionsManager.tallyVotes('${question.id}')">
                            <i class="fas fa-calculator me-2"></i>Tally Votes
                        </button>
                    ` : ''}
                    
                    <button class="btn btn-outline-secondary" onclick="QuestionsManager.showEditModal('${question.id}')">
                        <i class="fas fa-edit me-1"></i> Edit
                    </button>
                    <button class="btn btn-outline-danger" onclick="QuestionsManager.deleteQuestion('${question.id}')">
                        <i class="fas fa-trash me-1"></i> Delete
                    </button>
                </div>
            </div>
            
            ${!votingComplete ? `
                <div class="alert alert-info">
                    <i class="fas fa-info-circle me-2"></i>
                    Voting in progress. ${voteCount} votes collected.
                </div>
            ` : ''}
        `;
    },

    showTopAnswers: function(topAnswers) {
        const topAnswersSection = document.getElementById('top-answers-section');
        const topAnswersList = document.getElementById('top-answers-list');
        
        if (topAnswers && topAnswers.length > 0) {
            topAnswersList.innerHTML = topAnswers.map(answer => `
                <div class="list-group-item d-flex justify-content-between align-items-center">
                    <div>
                        <span class="badge bg-primary rounded-pill me-2">#${answer.rank}</span>
                        ${this.escapeHtml(answer.answer)}
                    </div>
                    <span class="badge bg-secondary rounded-pill">${answer.vote_count} votes</span>
                </div>
            `).join('');
            
            topAnswersSection.style.display = 'block';
        } else {
            topAnswersList.innerHTML = '<div class="list-group-item text-center">No answers available</div>';
            topAnswersSection.style.display = 'block';
        }
    },

    showEditModal: function(id) {
        Auth.fetchWithAuth(`/admin/questions/${id}`)
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
    },

    updateQuestion: async function() {
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
            const response = await Auth.fetchWithAuth(`/admin/questions/${id}`, {
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
            this.loadQuestions();
            this.loadQuestionDetails(id);
            
        } catch (error) {
            console.error('Error updating question:', error);
            alert('Failed to update question');
        }
    },

    addQuestion: async function() {
        const questionText = document.getElementById('questionText').value.trim();
        const guessPrompt = document.getElementById('guessPrompt').value.trim();
        const activeDate = document.getElementById('activeDate').value;
        
        if (!questionText || !activeDate) {
            alert('Please fill in all fields');
            return;
        }
        
        try {
            const response = await Auth.fetchWithAuth('/admin/questions', {
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
            this.loadQuestions();
            
            // Load the new question details if available
            if (data.question && data.question.id) {
                this.loadQuestionDetails(data.question.id);
            }
            
        } catch (error) {
            console.error('Error adding question:', error);
            alert('Failed to add question');
        }
    },

    tallyVotes: async function(id) {
        if (!confirm('Are you sure you want to tally votes? This will finalize the top answers for this question.')) {
            return;
        }
        
        try {
            const response = await Auth.fetchWithAuth(`/admin/tally/${id}`, {
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
            this.loadQuestions();
            this.loadQuestionDetails(id);
            
        } catch (error) {
            console.error('Error tallying votes:', error);
            alert('Failed to tally votes');
        }
    },

    deleteQuestion: async function(id) {
        if (!confirm('Are you sure you want to delete this question? This cannot be undone.')) {
            return;
        }
        
        try {
            const response = await Auth.fetchWithAuth(`/admin/questions/${id}`, {
                method: 'DELETE',
            });
            
            if (!response.ok) {
                throw new Error('Failed to delete question');
            }
            
            alert('Question deleted successfully!');
            this.loadQuestions();
            document.getElementById('questionDetails').innerHTML = 
                '<p class="text-center text-muted my-4">Select a question to view details</p>';
            
            // Hide vote distribution and top answers sections
            document.getElementById('vote-distribution-section').style.display = 'none';
            document.getElementById('top-answers-section').style.display = 'none';
            
        } catch (error) {
            console.error('Error deleting question:', error);
            alert('Failed to delete question');
        }
    },

    runDailyUpdate: async function() {
        try {
            // Show loading state via alert
            alert('Starting daily update - this may take a moment...');
            
            // Call the update endpoint with authentication
            const response = await Auth.fetchWithAuth('/admin/run-update');
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
};

// =================================
// Voting Manager Module
// =================================
const VotingManager = {
    showAddVotesForm: function(questionId) {
        document.getElementById('vote-question-id').value = questionId;
    },

    addVotes: async function() {
        const questionId = document.getElementById('vote-question-id').value;
        const response = document.getElementById('vote-response').value.trim();
        const count = parseInt(document.getElementById('vote-count').value);
        
        if (!response) {
            alert('Please enter a response');
            return;
        }
        
        if (isNaN(count) || count < 1) {
            alert('Please enter a valid count');
            return;
        }
        
        const responseElement = document.getElementById('add-votes-response');
        responseElement.innerHTML = `
            <div class="alert alert-info">
                <i class="fas fa-spinner fa-spin me-2"></i>
                Adding ${count} votes for "${response}"...
            </div>
        `;
        
        try {
            const apiResponse = await Auth.fetchWithAuth(`/admin/votes/${questionId}`, {
                method: 'POST',
                body: JSON.stringify({ 
                    response, 
                    count 
                }),
            });
            
            if (!apiResponse.ok) {
                throw new Error('Failed to add votes');
            }
            
            const data = await apiResponse.json();
            
            responseElement.innerHTML = `
                <div class="alert alert-success">
                    <i class="fas fa-check-circle me-2"></i>
                    ${data.message}
                </div>
            `;
            
            // Clear the form
            document.getElementById('vote-response').value = '';
            
            // Refresh the question details to show updated vote counts
            QuestionsManager.loadQuestionDetails(questionId);
            
        } catch (error) {
            console.error('Error adding votes:', error);
            responseElement.innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-circle me-2"></i>
                    Failed to add votes: ${error.message}
                </div>
            `;
        }
    },

    showVoteDistribution: function(voteDistribution, totalVotes) {
        const distributionSection = document.getElementById('vote-distribution-section');
        const tableBody = document.getElementById('vote-distribution-table');
        
        // Clear existing rows
        tableBody.innerHTML = '';
        
        // Add each vote response
        voteDistribution.forEach(vote => {
            const percentage = totalVotes > 0 
                ? ((vote.count / totalVotes) * 100).toFixed(1) 
                : 0;
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${QuestionsManager.escapeHtml(vote.response)}</td>
                <td>${vote.count}</td>
                <td>
                    <div class="progress" style="height: 20px;">
                        <div class="progress-bar" role="progressbar" 
                             style="width: ${percentage}%;" 
                             aria-valuenow="${percentage}" 
                             aria-valuemin="0" 
                             aria-valuemax="100">
                            ${percentage}%
                        </div>
                    </div>
                </td>
            `;
            tableBody.appendChild(row);
        });
        
        // Show the section
        distributionSection.style.display = 'block';
    }
};

// =================================
// Text Matching Module
// =================================
const TextMatchingTester = {
    setup: function() {
        const form = document.getElementById('text-matching-form');
        const resultsDiv = document.getElementById('matching-results');
        
        if (!form) return; // Exit if form not found
        
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const text1 = document.getElementById('text1').value.trim();
            const text2 = document.getElementById('text2').value.trim();
            
            if (!text1 || !text2) {
                alert('Please enter both text values');
                return;
            }
            
            try {
                const response = await Auth.fetchWithAuth('/admin/test-matching', {
                    method: 'POST',
                    body: JSON.stringify({ text1, text2 }),
                });
                
                if (!response.ok) {
                    throw new Error('Failed to test text matching');
                }
                
                const result = await response.json();
                this.displayMatchResults(result, resultsDiv);
                
            } catch (error) {
                console.error('Error testing match:', error);
                alert('Failed to test text matching');
            }
        });
    },
    
    displayMatchResults: function(result, resultsDiv) {
        // Show the results section
        resultsDiv.classList.remove('d-none');
        
        // Update match result
        const matchResultEl = document.getElementById('match-result');
        matchResultEl.textContent = result.isMatch ? 'The texts MATCH!' : 'The texts DO NOT match.';
        matchResultEl.className = result.isMatch ? 'alert alert-success' : 'alert alert-danger';
        
        // Update normalized text
        document.getElementById('normalized-text1').textContent = result.normalized.text1;
        document.getElementById('normalized-text2').textContent = result.normalized.text2;
        
        // Update metrics
        document.getElementById('levenshtein-distance').textContent = result.metrics.levenshteinDistance;
        document.getElementById('character-similarity').textContent = 
            (result.metrics.characterSimilarity * 100).toFixed(2) + '%';
        document.getElementById('word-similarity').textContent = 
            (result.metrics.wordSimilarity * 100).toFixed(2) + '%';
    }
};

// =================================
// Initialization
// =================================
document.addEventListener('DOMContentLoaded', () => {
    // Setup event listeners
    document.getElementById('login-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        Auth.login(username, password);
    });
    
    document.getElementById('saveQuestionBtn').addEventListener('click', () => QuestionsManager.addQuestion());
    document.getElementById('updateQuestionBtn').addEventListener('click', () => QuestionsManager.updateQuestion());
    
    const updateBtn = document.getElementById('run-update-btn');
    if (updateBtn) {
        updateBtn.addEventListener('click', () => QuestionsManager.runDailyUpdate());
    }

    const addVotesBtn = document.getElementById('add-votes-btn');
    if (addVotesBtn) {
        addVotesBtn.addEventListener('click', () => VotingManager.addVotes());
    }

    // Setup text matching tester
    TextMatchingTester.setup();
    
    // Check for existing auth
    Auth.checkExistingAuth();
    
    // Expose modules to global scope for onclick handlers
    window.Auth = Auth;
    window.QuestionsManager = QuestionsManager;
    window.VotingManager = VotingManager;
    window.TextMatchingTester = TextMatchingTester;
});