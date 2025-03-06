// Escape HTML for safe display
export function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Get appropriate CSS class for status badge
export function getStatusBadgeClass(status) {
    switch (status) {
        case 'active': return 'bg-success';
        case 'voting': return 'bg-warning';
        case 'upcoming': return 'bg-info';
        case 'completed': return 'bg-secondary';
        default: return 'bg-light';
    }
}

// Get display text for status
export function getStatusText(status) {
    switch (status) {
        case 'active': return 'Guessing';
        case 'voting': return 'Voting';
        case 'upcoming': return 'Upcoming';
        case 'completed': return 'Completed';
        default: return status;
    }
}