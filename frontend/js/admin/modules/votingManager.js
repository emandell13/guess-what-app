// votingManager.js - Vote management for admin panel
import Auth from './auth.js';
import { escapeHtml } from '../../utils/adminUtils.js';

const VotingManager = {
    showAddVotesForm: function (questionId) {
        document.getElementById('vote-question-id').value = questionId;
    },

    addVotes: async function () {
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
            window.app.questionManager.loadQuestionDetails(questionId);

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

    tallyVotes: async function (questionId) {
        if (!confirm('Are you sure you want to tally votes? This will finalize the top answers for this question.')) {
            return;
        }

        try {
            const response = await Auth.fetchWithAuth(`/admin/tally/${questionId}`, {
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
            window.app.questionManager.loadQuestions();
            window.app.questionManager.loadQuestionDetails(questionId);

        } catch (error) {
            console.error('Error tallying votes:', error);
            alert('Failed to tally votes');
        }
    },

    showVoteDistribution: async function (questionId, totalVotesTop10) {
        try {
            // Fetch the grouped vote distribution using fuzzy matching
            const response = await Auth.fetchWithAuth(`/admin/votes/distribution/${questionId}`);

            if (!response.ok) {
                throw new Error('Failed to fetch vote distribution');
            }

            const data = await response.json();

            if (data.voteGroups && data.voteGroups.length > 0) {
                this.displayVoteGroups(data.voteGroups, totalVotesTop10);
            } else {
                document.getElementById('vote-distribution-section').style.display = 'none';
            }
        } catch (error) {
            console.error('Error fetching vote distribution:', error);
            document.getElementById('vote-distribution-section').style.display = 'none';
        }
    },

    displayVoteGroups: function (voteGroups, totalVotesTop10) {
        const distributionSection = document.getElementById('vote-distribution-section');
        const tableBody = document.getElementById('vote-distribution-table');

        // Clear existing rows
        tableBody.innerHTML = '';

        // Add each vote group
        voteGroups.forEach(group => {
            const percentage = totalVotesTop10 > 0
                ? ((group.count / totalVotesTop10) * 100).toFixed(1)
                : 0;

            const row = document.createElement('tr');

            // Create examples tooltip if there are variations
            let examplesText = '';
            if (group.examples && group.examples.length > 1) {
                const variations = group.examples
                    .filter(ex => ex !== group.canonicalAnswer)
                    .map(ex => `"${escapeHtml(ex)}"`)
                    .join(', ');

                if (variations) {
                    examplesText = `
                        <span class="ms-2 badge bg-secondary rounded-pill" 
                            data-bs-toggle="tooltip" 
                            title="Variations: ${variations}">
                            ${group.examples.length > 2 ? (group.examples.length - 1) + ' variations' : '1 variation'}
                        </span>
                    `;
                }
            }

            row.innerHTML = `
                <td>
                    ${escapeHtml(group.canonicalAnswer)}
                    ${examplesText}
                </td>
                <td>${group.count}</td>
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

        // Initialize tooltips
        const tooltips = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
        tooltips.map(function (tooltip) {
            return new bootstrap.Tooltip(tooltip);
        });

        // Show the section
        distributionSection.style.display = 'block';
    }
};

export default VotingManager;