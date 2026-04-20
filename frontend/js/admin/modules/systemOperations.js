// systemOperations.js - System-wide administrative operations
import Auth from './auth.js';

const SystemOperations = {
    // Local state for the pipeline table — kept here so column-header clicks
    // can re-render without re-fetching.
    _pipelineRows: [],
    _sortKey: 'pick_count',
    _sortDir: 'desc',

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
        const bodyEl = document.getElementById('pipeline-table-body');
        if (!statusEl) return;

        try {
            const response = await Auth.fetchWithAuth('/admin/content/pipeline-status');
            const data = await response.json();

            const candidatePool = data.candidate_pool_size ?? 0;
            const target = data.target_pool_size ?? 10;
            const tone = candidatePool >= target ? 'text-success' : 'text-warning';
            statusEl.className = `mb-3 small ${tone}`;
            statusEl.innerHTML = `<i class="fas fa-circle-info me-1"></i>${candidatePool} candidate${candidatePool === 1 ? '' : 's'} in pool (target: ${target}). ${data.upcoming_count - candidatePool} scheduled.`;

            this._pipelineRows = data.upcoming || [];
            this._renderPipelineTable();
            this._wireSortHandlers();
        } catch (error) {
            console.error('Error loading pipeline status:', error);
            statusEl.className = 'mb-3 small text-danger';
            statusEl.textContent = 'Failed to load pipeline status.';
            if (bodyEl) {
                bodyEl.innerHTML = `<tr><td colspan="5" class="text-center text-danger small py-3">Failed to load pipeline.</td></tr>`;
            }
        }
    },

    _wireSortHandlers: function () {
        // Idempotent — replace the click handler each time so re-renders don't pile up listeners.
        const headers = document.querySelectorAll('#pipeline-table th.sortable');
        headers.forEach(th => {
            const key = th.dataset.key;
            th.onclick = () => {
                if (this._sortKey === key) {
                    this._sortDir = this._sortDir === 'asc' ? 'desc' : 'asc';
                } else {
                    this._sortKey = key;
                    // Numeric / date columns default to descending; text to ascending.
                    this._sortDir = ['pick_count', 'impression_count', 'active_date'].includes(key) ? 'desc' : 'asc';
                }
                this._renderPipelineTable();
            };
        });
    },

    _renderPipelineTable: function () {
        const bodyEl = document.getElementById('pipeline-table-body');
        if (!bodyEl) return;

        if (this._pipelineRows.length === 0) {
            bodyEl.innerHTML = `<tr><td colspan="5" class="text-center text-muted small py-3">No candidates or scheduled questions.</td></tr>`;
            this._updateSortIndicators();
            return;
        }

        const key = this._sortKey;
        const dir = this._sortDir;
        const numericKeys = new Set(['pick_count', 'impression_count']);

        const rows = this._pipelineRows.slice().sort((a, b) => {
            let av = a[key];
            let bv = b[key];
            // Nulls (e.g. active_date for candidates) sort last regardless of direction.
            if (av === null || av === undefined) return 1;
            if (bv === null || bv === undefined) return -1;
            if (numericKeys.has(key)) {
                av = Number(av) || 0;
                bv = Number(bv) || 0;
                return dir === 'asc' ? av - bv : bv - av;
            }
            const cmp = String(av).localeCompare(String(bv));
            return dir === 'asc' ? cmp : -cmp;
        });

        const escape = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[ch]));

        bodyEl.innerHTML = rows.map(r => {
            const statusBadge = r.status === 'candidate'
                ? '<span class="badge bg-secondary">candidate</span>'
                : r.status === 'scheduled'
                    ? '<span class="badge bg-success">scheduled</span>'
                    : `<span class="badge bg-light text-dark">${escape(r.status)}</span>`;
            const date = r.active_date ? escape(r.active_date) : '<span class="text-muted">—</span>';
            return `
                <tr>
                    <td>${statusBadge}</td>
                    <td class="small">${escape(r.question_text)}</td>
                    <td class="text-end">${r.pick_count}</td>
                    <td class="text-end">${r.impression_count}</td>
                    <td class="small">${date}</td>
                </tr>`;
        }).join('');

        this._updateSortIndicators();
    },

    _updateSortIndicators: function () {
        const headers = document.querySelectorAll('#pipeline-table th.sortable');
        headers.forEach(th => {
            const key = th.dataset.key;
            // Strip any prior arrow (unicode arrows or fa icons we previously injected).
            th.innerHTML = th.innerHTML.replace(/\s*[▲▼]\s*$/, '');
            if (key === this._sortKey) {
                th.innerHTML += this._sortDir === 'asc' ? ' ▲' : ' ▼';
            }
        });
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
                resultEl.innerHTML = `<div class="alert alert-info mb-0">Pool already at target — nothing to generate.</div>`;
            } else {
                const createdList = (data.created || []).map(q => `<li>${q.question_text}</li>`).join('');
                resultEl.innerHTML = `
                    <div class="alert alert-success mb-0">
                        Generated <strong>${data.generated}</strong> new candidate${data.generated === 1 ? '' : 's'}.
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
