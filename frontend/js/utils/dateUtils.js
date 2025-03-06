/**
 * Date utility functions for the frontend
 */

/**
 * Gets today's date in Eastern Time as a YYYY-MM-DD string
 */
export function getTodayDateET() {
  const et = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
  const etDate = new Date(et);
  return formatDateString(etDate);
}

/**
 * Gets tomorrow's date in Eastern Time as a YYYY-MM-DD string
 */
export function getTomorrowDateET() {
  const et = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
  const etDate = new Date(et);
  etDate.setDate(etDate.getDate() + 1);
  return formatDateString(etDate);
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
    month: 'short',
    day: 'numeric'
  });
}