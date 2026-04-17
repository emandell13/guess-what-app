// systemOperations.js - System-wide administrative operations
import Auth from './auth.js';

const SystemOperations = {
    runDailyUpdate: async function () {
        try {
            // Show loading state via alert
            alert('Starting daily update - this may take a moment...');

            // Call the update endpoint with authentication
            const response = await Auth.fetchWithAuth('/admin/tools/run-update');
            const result = await response.json();

            // Show result
            if (result.success) {
                alert(`Update completed successfully!\n\nMessage: ${result.message}`);
                return true;
            } else {
                alert(`Update failed.\n\nError: ${result.error || 'Unknown error'}`);
                return false;
            }
        } catch (error) {
            console.error('Error running update:', error);
            alert(`Failed to run update: ${error.message}`);
            return false;
        }
    },

    loadPipelineStatus: async function () {
        const statusEl = document.getElementById('pipeline-status');
        if (!statusEl) return;

        try {
            const response = await Auth.fetchWithAuth('/admin/content/pipeline-status');
            const data = await response.json();
            const count = data.upcoming_count ?? 0;
            const target = 7;
            const tone = count >= target ? 'text-success' : 'text-warning';
            statusEl.className = `mb-3 small ${tone}`;
            statusEl.innerHTML = `<i class="fas fa-circle-info me-1"></i>${count} upcoming question${count === 1 ? '' : 's'} queued (target: ${target}).`;
        } catch (error) {
            console.error('Error loading pipeline status:', error);
            statusEl.className = 'mb-3 small text-danger';
            statusEl.textContent = 'Failed to load pipeline status.';
        }
    },

    runReplenishment: async function () {
        const button = document.getElementById('run-replenish-btn');
        const resultEl = document.getElementById('replenish-result');
        if (!button || !resultEl) return;

        const originalText = button.innerHTML;
        button.disabled = true;
        button.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Generating...';
        resultEl.innerHTML = '';

        try {
            const response = await Auth.fetchWithAuth('/admin/content/replenish', { method: 'POST' });
            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Replenishment failed');
            }

            if (data.generated === 0) {
                resultEl.innerHTML = `<div class="alert alert-info mb-0">Queue already full — nothing to generate.</div>`;
            } else {
                const createdList = (data.created || []).map(q => `<li><strong>${q.active_date}</strong> — ${q.question_text}</li>`).join('');
                resultEl.innerHTML = `
                    <div class="alert alert-success mb-0">
                        Generated <strong>${data.generated}</strong> new question${data.generated === 1 ? '' : 's'}
                        with <strong>${data.seeded}</strong> seed vote${data.seeded === 1 ? '' : 's'}.
                        <ul class="mb-0 mt-2 small">${createdList}</ul>
                    </div>`;
            }

            // Refresh status + question list so the new items show up immediately
            this.loadPipelineStatus();
            if (window.app && window.app.questionManager) {
                window.app.questionManager.loadQuestions();
            }
        } catch (error) {
            console.error('Error running replenishment:', error);
            resultEl.innerHTML = `<div class="alert alert-danger mb-0">${error.message}</div>`;
        } finally {
            button.disabled = false;
            button.innerHTML = originalText;
        }
    }
};

export default SystemOperations;