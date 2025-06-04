/**
 * Date utility functions for the frontend
 */

/**
 * Gets today's date in the application timezone (PT) as a YYYY-MM-DD string
 */
export function getTodayDate() {
  const pt = new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" });
  const localDate = new Date(pt);
  return formatDateString(localDate);
}

/**
 * Gets tomorrow's date in the application timezone (PT) as a YYYY-MM-DD string
 */
export function getTomorrowDate() {
  const pt = new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" });
  const localDate = new Date(pt);
  localDate.setDate(localDate.getDate() + 1);
  return formatDateString(localDate);
}

/**
 * Formats a Date object as a YYYY-MM-DD string
 */
export function formatDateString(date) {
  return date.getFullYear() + '-' +
    String(date.getMonth() + 1).padStart(2, '0') + '-' +
    String(date.getDate()).padStart(2, '0');
}

// Format date string from YYYY-MM-DD to readable format
export function formatDisplayDate(dateString) {
  if (!dateString) return '';
  // Create date object from YYYY-MM-DD string
  const date = new Date(dateString + 'T00:00:00'); // Add time to ensure consistent parsing
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}