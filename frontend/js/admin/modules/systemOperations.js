// modules/systemOperations.js
import Auth from './auth.js';

class SystemOperations {
    async runDailyUpdate() {
        try {
            // Show loading state
            const resultContainer = document.getElementById('system-operation-result');
            resultContainer.innerHTML = '<div class="alert alert-info"><i class="fas fa-spinner fa-spin me-2"></i> Running daily update...</div>';
            
            // Get authentication credentials
            const authHeader = Auth.getAuthHeader();
            
            // Call the server API endpoint
            const response = await fetch('/admin/tools/run-update', {
                method: 'GET',
                headers: {
                    'Authorization': authHeader
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to run daily update');
            }
            
            const result = await response.json();
            
            // Update UI with result
            if (result.success) {
                resultContainer.innerHTML = '<div class="alert alert-success"><i class="fas fa-check-circle me-2"></i> Daily update completed successfully!</div>';
            } else {
                resultContainer.innerHTML = `<div class="alert alert-warning"><i class="fas fa-exclamation-triangle me-2"></i> Daily update completed with warnings: ${result.message || 'Unknown error'}</div>`;
            }
        } catch (error) {
            console.error('Error running daily update:', error);
            document.getElementById('system-operation-result').innerHTML = `<div class="alert alert-danger"><i class="fas fa-times-circle me-2"></i> Error: ${error.message}</div>`;
        }
    }
}

export default new SystemOperations();