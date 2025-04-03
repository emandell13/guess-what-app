// textMatchingTester.js - Text matching utility for admin panel
import Auth from './auth.js';

const TextMatchingTester = {
    setup: function () {
        const form = document.getElementById('text-matching-form');
        const resultsDiv = document.getElementById('matching-results');

        if (!form) return; // Exit if form not found

        // Update form to include question context field
        if (!document.getElementById('question-context')) {
            const inputGroup = form.querySelector('.row');
            
            // Create a new div for the question context
            const contextDiv = document.createElement('div');
            contextDiv.className = 'col-12 mb-3';
            contextDiv.innerHTML = `
                <label for="question-context" class="form-label">Question Context (Optional)</label>
                <input type="text" class="form-control" id="question-context" 
                       placeholder="e.g., 'What's your favorite food?'">
                <div class="form-text">Adding question context can improve matching accuracy</div>
            `;
            
            // Insert after the existing inputs
            inputGroup.appendChild(contextDiv);
        }

        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const text1 = document.getElementById('text1').value.trim();
            const text2 = document.getElementById('text2').value.trim();
            const questionContext = document.getElementById('question-context')?.value.trim();

            if (!text1 || !text2) {
                alert('Please enter both text values');
                return;
            }

            try {
                // Update to use the new semantic matching endpoint
                const response = await Auth.fetchWithAuth('/admin/tools/test-semantic-matching', {
                    method: 'POST',
                    body: JSON.stringify({ text1, text2, questionContext }),
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

    displayMatchResults: function (result, resultsDiv) {
        // Show the results section
        resultsDiv.classList.remove('d-none');
    
        // Update match result
        const matchResultEl = document.getElementById('match-result');
        matchResultEl.textContent = result.isMatch ? 'The texts MATCH!' : 'The texts DO NOT match.';
        matchResultEl.className = result.isMatch ? 'alert alert-success' : 'alert alert-danger';
    
        // Update normalized text
        document.getElementById('normalized-text1').textContent = result.normalized.text1;
        document.getElementById('normalized-text2').textContent = result.normalized.text2;
    
        // Create or update the metrics section
        const metricsDiv = document.querySelector('#matching-results .card:last-child .card-body .row');
        
        // Clear previous metrics
        metricsDiv.innerHTML = '';
        
        // Add metrics based on what's available in the result
        if (result.metrics) {
            // Add question context section if it was used
            if (result.questionContext) {
                const contextDiv = document.createElement('div');
                contextDiv.className = 'col-12 mb-3';
                contextDiv.innerHTML = `
                    <div class="alert alert-info">
                        <strong>Question Context:</strong> "${result.questionContext}"
                    </div>
                `;
                metricsDiv.appendChild(contextDiv);
            }
            
            // Add metrics columns
            if (result.metrics.semanticSimilarity !== undefined) {
                const similarityDiv = document.createElement('div');
                similarityDiv.className = 'col-md-6';
                similarityDiv.innerHTML = `
                    <p><strong>Semantic Similarity:</strong> 
                        <span>${(result.metrics.semanticSimilarity * 100).toFixed(2)}%</span>
                    </p>
                `;
                metricsDiv.appendChild(similarityDiv);
            }
            
            // Add additional metrics for question-contextualized matching
            if (result.metrics.baseSimilarity !== undefined) {
                const baseSimDiv = document.createElement('div');
                baseSimDiv.className = 'col-md-6';
                baseSimDiv.innerHTML = `
                    <p><strong>Base Similarity:</strong> 
                        <span>${(result.metrics.baseSimilarity * 100).toFixed(2)}%</span>
                    </p>
                `;
                metricsDiv.appendChild(baseSimDiv);
                
                const text1ToQuestionDiv = document.createElement('div');
                text1ToQuestionDiv.className = 'col-md-6';
                text1ToQuestionDiv.innerHTML = `
                    <p><strong>Text1 to Question:</strong> 
                        <span>${(result.metrics.text1ToQuestion * 100).toFixed(2)}%</span>
                    </p>
                `;
                metricsDiv.appendChild(text1ToQuestionDiv);
                
                const text2ToQuestionDiv = document.createElement('div');
                text2ToQuestionDiv.className = 'col-md-6';
                text2ToQuestionDiv.innerHTML = `
                    <p><strong>Text2 to Question:</strong> 
                        <span>${(result.metrics.text2ToQuestion * 100).toFixed(2)}%</span>
                    </p>
                `;
                metricsDiv.appendChild(text2ToQuestionDiv);
                
                const relevanceBoostDiv = document.createElement('div');
                relevanceBoostDiv.className = 'col-md-6';
                relevanceBoostDiv.innerHTML = `
                    <p><strong>Relevance Boost:</strong> 
                        <span>${(result.metrics.relevanceBoost * 100).toFixed(2)}%</span>
                    </p>
                `;
                metricsDiv.appendChild(relevanceBoostDiv);
            }
        }
        
        // Display error if present
        if (result.error) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'alert alert-warning mt-3';
            errorDiv.innerHTML = `<strong>Error:</strong> ${result.error}`;
            resultsDiv.appendChild(errorDiv);
        }
    }
};

export default TextMatchingTester;