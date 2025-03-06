// systemOperations.js - System-wide administrative operations
import Auth from './auth.js';

const SystemOperations = {
    runDailyUpdate: async function () {
        try {
            // Show loading state via alert
            alert('Starting daily update - this may take a moment...');

            // Call the update endpoint with authentication
            const response = await Auth.fetchWithAuth('/admin/run-update');
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
    }
};

export default SystemOperations;