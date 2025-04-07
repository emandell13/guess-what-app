/**
 * Date utility functions for consistent date handling across the application
 */

/**
 * Gets today's date in the application timezone (PT) as a YYYY-MM-DD string
 */
function getTodayDate() {
  const appDate = new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" });
  const localDate = new Date(appDate);
  return formatDateString(localDate);
}

/**
* Gets tomorrow's date in the application timezone (PT) as a YYYY-MM-DD string
*/
function getTomorrowDate() {
  const appDate = new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" });
  const localDate = new Date(appDate);
  localDate.setDate(localDate.getDate() + 1);
  return formatDateString(localDate);
}

/**
* Gets a Date object from a YYYY-MM-DD string, interpreting it in the application timezone
*/
function getDateFromString(dateString) {
  // Add noon PT time to prevent date shifting due to timezone issues
  return new Date(`${dateString}T12:00:00-08:00`);
}

/**
* Formats a Date object as a YYYY-MM-DD string
*/
function formatDateString(date) {
  return date.getFullYear() + '-' +
    String(date.getMonth() + 1).padStart(2, '0') + '-' +
    String(date.getDate()).padStart(2, '0');
}

/**
* Formats a date string for display in application timezone with custom formatting
*/
function formatDateForDisplay(dateString, options = {}) {
  const localDate = getDateFromString(dateString);

  const defaultOptions = {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  };

  return localDate.toLocaleDateString('en-US', { ...defaultOptions, ...options });
}

module.exports = {
  getTodayDate,
  getTomorrowDate,
  getDateFromString,
  formatDateString,
  formatDateForDisplay
};