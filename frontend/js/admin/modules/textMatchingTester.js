// textMatchingTester.js - Text matching utility for admin panel
import Auth from './auth.js';

const TextMatchingTester = {
    setup: function () {
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

        // Update metrics
        document.getElementById('levenshtein-distance').textContent = result.metrics.levenshteinDistance;
        document.getElementById('character-similarity').textContent =
            (result.metrics.characterSimilarity * 100).toFixed(2) + '%';
        document.getElementById('word-similarity').textContent =
            (result.metrics.wordSimilarity * 100).toFixed(2) + '%';
    }
};

export default TextMatchingTester;