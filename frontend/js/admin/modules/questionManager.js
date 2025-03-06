// questionManager.js - Question management for admin panel
import Auth from './auth.js';
import { formatDate } from '../../utils/dateUtils.js';
import { escapeHtml, getStatusBadgeClass, getStatusText } from '../../utils/adminUtils.js';
import { getTodayDateET, getTomorrowDateET } from '../../utils/dateUtils.js';

const QuestionsManager = {
    loadQuestions: async function () {
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
                       data-id="${question.id}" onclick="window.app.questionManager.loadQuestionDetails('${question.id}'); return false;">
                        <div>
                            <div class="fw-bold">${escapeHtml(question.question_text)}</div>
                            <small class="text-muted">Active Date: ${formatDate(question.active_date)}</small>
                        </div>
                        <span class="badge ${getStatusBadgeClass(question.status)} rounded-pill">
                            ${getStatusText(question.status)}
                        </span>
                    </a>
                `).join('');
            } else {
                questionsList.innerHTML = '<div class="list-group-item text-center py-3">No questions found</div>';
            }

            // Return a resolved promise to signal completion
            return Promise.resolve();
        } catch (error) {
            console.error('Error loading questions:', error);
            document.getElementById('questionsList').innerHTML =
                '<div class="list-group-item text-danger text-center">Failed to load questions</div>';

            // Return a rejected promise if there's an error
            return Promise.reject(error);
        }
    },

    setupStatusFilters: function() {
        const self = this; // Preserve 'this' reference
        
        // Get all filter buttons
        const filterButtons = document.querySelectorAll('[data-filter]');
        
        // Remove existing event listeners to prevent duplicates
        filterButtons.forEach(button => {
            const newButton = button.cloneNode(true);
            button.parentNode.replaceChild(newButton, button);
        });
        
        // Add event listeners to the fresh buttons
        document.querySelectorAll('[data-filter]').forEach(button => {
            button.addEventListener('click', function() {
                const status = this.getAttribute('data-filter');
                
                // Update active state
                document.querySelectorAll('[data-filter]').forEach(btn => {
                    btn.classList.remove('active');
                });
                this.classList.add('active');
                
                // Use the preserved reference to QuestionsManager
                self.filterQuestionsByStatus(status);
            });
        });
    },

    filterQuestionsByStatus: function(status) {
        // Get all question items
        const items = document.querySelectorAll('#questionsList a.list-group-item-action');
        
        // Remove any existing "no questions" message
        const existingMsg = document.querySelector('#questionsList .no-questions-message');
        if (existingMsg) {
            existingMsg.remove();
        }
        
        // Track visible items
        let visibleCount = 0;
        
        // Apply the filter
        items.forEach(item => {
            const badge = item.querySelector('.badge');
            if (!badge) return;
            
            // Get status from badge text
            const text = badge.textContent.trim();
            let itemStatus;
            
            if (text.includes('Guessing')) itemStatus = 'active';
            else if (text.includes('Voting')) itemStatus = 'voting';
            else if (text.includes('Upcoming')) itemStatus = 'upcoming';
            else if (text.includes('Completed')) itemStatus = 'completed';
            else itemStatus = 'unknown';
            
            // Set visibility based on status
            if (status === 'all' || itemStatus === status) {
                item.setAttribute('style', 'display: block !important');
                visibleCount++;
            } else {
                item.setAttribute('style', 'display: none !important');
            }
        });
        
        // Show a message if no items are visible
        if (visibleCount === 0 && items.length > 0) {
            const msg = document.createElement('div');
            msg.className = 'list-group-item text-center py-3 no-questions-message';
            msg.textContent = `No ${status !== 'all' ? status : ''} questions found`;
            document.getElementById('questionsList').appendChild(msg);
        }
    },

    updateQuestionInfo: function (question, voteCount) {
        const detailsContainer = document.getElementById('questionDetails');

        // Get status text and badge class
        const statusText = getStatusText(question.status || 'unknown');
        const statusClass = getStatusBadgeClass(question.status || 'unknown');

        detailsContainer.innerHTML = `
            <div class="mb-4">
                <h3>${escapeHtml(question.question_text)}</h3>
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <div><strong>Active Date:</strong> ${formatDate(question.active_date)}</div>
                    <div class="badge ${statusClass} rounded-pill">
                        ${statusText}
                    </div>
                </div>
                <div class="mb-3"><strong>Votes received:</strong> ${voteCount}</div>
                
                <div class="action-buttons">
                    ${question.status === 'voting' ? `
                        <button class="btn btn-primary" onclick="window.app.questionManager.tallyVotes('${question.id}')">
                            <i class="fas fa-calculator me-2"></i>Tally Votes
                        </button>
                    ` : ''}
                    
                    <button class="btn btn-outline-secondary" onclick="window.app.questionManager.showEditModal('${question.id}')">
                        <i class="fas fa-edit me-1"></i> Edit
                    </button>
                    <button class="btn btn-outline-danger" onclick="window.app.questionManager.deleteQuestion('${question.id}')">
                        <i class="fas fa-trash me-1"></i> Delete
                    </button>
                </div>
            </div>
            
            ${question.status === 'voting' ? `
                <div class="alert alert-info">
                    <i class="fas fa-info-circle me-2"></i>
                    Voting in progress. ${voteCount} votes collected.
                </div>
            ` : ''}
            
            ${question.status === 'upcoming' ? `
                <div class="alert alert-info">
                    <i class="fas fa-info-circle me-2"></i>
                    This question is scheduled for the future.
                </div>
            ` : ''}
            
            ${question.status === 'active' ? `
                <div class="alert alert-success">
                    <i class="fas fa-check-circle me-2"></i>
                    This question is active today for guessing.
                </div>
            ` : ''}
            
            ${question.status === 'completed' ? `
                <div class="alert alert-secondary">
                    <i class="fas fa-history me-2"></i>
                    This is a past question.
                </div>
            ` : ''}
        `;
    },

    loadQuestionDetails: async function (id) {
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

                // Show/hide sections based on status
                const status = data.question.status ||
                    (data.question.active_date === getTodayDateET() && data.question.voting_complete ? 'active' :
                        data.question.active_date === getTomorrowDateET() && !data.question.voting_complete ? 'voting' : 'unknown');

                // Update/show top answers if voting is complete
                if ((status === 'active' || status === 'completed') && data.topAnswers) {
                    this.showTopAnswers(data.topAnswers);
                    document.getElementById('top-answers-section').style.display = 'block';
                } else {
                    document.getElementById('top-answers-section').style.display = 'none';
                }

                // Update vote distribution if in voting phase or if there are votes
                if (status === 'voting' && data.voteDistribution && data.voteDistribution.length > 0) {
                    window.app.votingManager.showVoteDistribution(id, data.voteCount);
                    document.getElementById('vote-distribution-section').style.display = 'block';
                } else {
                    document.getElementById('vote-distribution-section').style.display = 'none';
                }

                // Show add votes form only for voting phase questions
                const addVotesForm = document.getElementById('add-votes-form').closest('.card');
                if (status === 'voting') {
                    window.app.votingManager.showAddVotesForm(id);
                    addVotesForm.style.display = 'block';
                } else {
                    addVotesForm.style.display = 'none';
                }
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

    showTopAnswers: function (topAnswers) {
        const topAnswersSection = document.getElementById('top-answers-section');
        const topAnswersList = document.getElementById('top-answers-list');

        if (topAnswers && topAnswers.length > 0) {
            topAnswersList.innerHTML = topAnswers.map(answer => `
                <div class="list-group-item d-flex justify-content-between align-items-center">
                    <div>
                        <span class="badge bg-primary rounded-pill me-2">#${answer.rank}</span>
                        ${escapeHtml(answer.answer)}
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

    showEditModal: async function (id) {
        try {
            const response = await Auth.fetchWithAuth(`/admin/questions/${id}`);
            const data = await response.json();
            
            if (data.question) {
                document.getElementById('editQuestionId').value = data.question.id;
                document.getElementById('editQuestionText').value = data.question.question_text;
                document.getElementById('editGuessPrompt').value = data.question.guess_prompt || '';
                document.getElementById('editActiveDate').value = data.question.active_date.split('T')[0];
                document.getElementById('editVotingComplete').checked = data.question.voting_complete;

                const editQuestionModal = new bootstrap.Modal(document.getElementById('editQuestionModal'));
                editQuestionModal.show();
            }
        } catch (error) {
            console.error('Error fetching question for edit:', error);
            alert('Failed to load question for editing');
        }
    },

    updateQuestion: async function () {
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

            const editQuestionModal = bootstrap.Modal.getInstance(document.getElementById('editQuestionModal'));
            editQuestionModal.hide();
            this.loadQuestions();
            this.loadQuestionDetails(id);

        } catch (error) {
            console.error('Error updating question:', error);
            alert('Failed to update question');
        }
    },

    addQuestion: async function () {
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

            const addQuestionModal = bootstrap.Modal.getInstance(document.getElementById('addQuestionModal'));
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

    tallyVotes: async function (id) {
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

    deleteQuestion: async function (id) {
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
};

export default QuestionsManager;