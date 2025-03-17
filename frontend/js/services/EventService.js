/**
 * Centralized service for handling application events
 */
class EventService {
    /**
     * Dispatches a custom event
     * @param {string} eventName - The name of the event
     * @param {object} data - The data to include with the event
     */
    emit(eventName, data) {
      console.log(`Emitting event: ${eventName}`, data); // Helpful for debugging
      const event = new CustomEvent(eventName, { detail: data });
      document.dispatchEvent(event);
    }
  
    /**
     * Subscribes to an event
     * @param {string} eventName - The name of the event
     * @param {function} callback - The function to call when the event is emitted
     * @returns {function} - A function to remove the event listener
     */
    on(eventName, callback) {
      document.addEventListener(eventName, callback);
      
      // Return a function to remove the listener
      return () => {
        document.removeEventListener(eventName, callback);
      };
    }
  
    /**
     * Removes an event listener
     * @param {string} eventName - The name of the event
     * @param {function} callback - The callback to remove
     */
    off(eventName, callback) {
      document.removeEventListener(eventName, callback);
    }
  }
  
  // Create a singleton instance
  const eventService = new EventService();
  export default eventService;