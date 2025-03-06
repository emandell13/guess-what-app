// auth.js - Authentication module for admin panel

const Auth = {
    setCredentials: function (username, password) {
        const authCredentials = btoa(`${username}:${password}`);
        // Store credentials in session storage (cleared when browser closes)
        sessionStorage.setItem('adminAuth', authCredentials);
    },

    getCredentials: function () {
        // Try to get from session storage
        return sessionStorage.getItem('adminAuth');
    },

    clearCredentials: function () {
        sessionStorage.removeItem('adminAuth');
    },

    fetchWithAuth: async function (url, options = {}) {
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

    login: async function (username, password) {
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
                return true; // Authentication successful
            } else {
                // Clear credentials
                this.clearCredentials();
                return false; // Authentication failed
            }
        } catch (error) {
            console.error('Login error:', error);
            this.clearCredentials();
            return false; // Authentication failed
        }
    },

    checkExistingAuth: async function () {
        if (this.getCredentials()) {
            // Try to verify credentials
            try {
                const response = await this.fetchWithAuth('/admin/questions');
                return response.ok;
            } catch (error) {
                this.clearCredentials();
                return false;
            }
        }
        return false;
    }
};

export default Auth;