/**
 * Date utility functions for consistent date handling across the application
 */

/**
 * Gets today's date in Eastern Time as a YYYY-MM-DD string
 */
function getTodayDateET() {
    const et = new Date().toLocaleString("en-US", {timeZone: "America/New_York"});
    const etDate = new Date(et);
    return formatDateString(etDate);
  }
  
  /**
   * Gets tomorrow's date in Eastern Time as a YYYY-MM-DD string
   */
  function getTomorrowDateET() {
    const et = new Date().toLocaleString("en-US", {timeZone: "America/New_York"});
    const etDate = new Date(et);
    etDate.setDate(etDate.getDate() + 1);
    return formatDateString(etDate);
  }
  
  /**
   * Gets a Date object from a YYYY-MM-DD string, interpreting it in Eastern Time
   */
  function getDateFromString(dateString) {
    // Add noon ET time to prevent date shifting due to timezone issues
    return new Date(`${dateString}T12:00:00-05:00`);
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
   * Formats a date string for display in ET timezone with custom formatting
   */
  function formatDateForDisplay(dateString, options = {}) {
    const etDate = getDateFromString(dateString);
    
    const defaultOptions = {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    };
    
    return etDate.toLocaleDateString('en-US', {...defaultOptions, ...options});
  }
  
  module.exports = {
    getTodayDateET,
    getTomorrowDateET,
    getDateFromString,
    formatDateString,
    formatDateForDisplay
  };