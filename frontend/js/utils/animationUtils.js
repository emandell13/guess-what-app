/**
 * Animation utilities for UI components
 */

/**
 * Adds a flip reveal animation to a DOM element
 * @param {HTMLElement} element - The element to animate
 * @param {Function} onHalfway - Function to call halfway through the animation
 * @param {Function} onComplete - Function to call when animation completes
 */
export function flipReveal(element, onHalfway, onComplete) {
    // Add animation class
    element.classList.add("answer-reveal");
    
    // Call the halfway function after 500ms (halfway through the 1s animation)
    setTimeout(() => {
      if (onHalfway) onHalfway();
    }, 500);
    
    // Remove animation class and call complete function after animation
    setTimeout(() => {
      element.classList.remove("answer-reveal");
      if (onComplete) onComplete();
    }, 1000);
  }
  
  /**
   * Adds a strike reveal animation to a DOM element
   * @param {HTMLElement} element - The element to animate
   */
  export function strikeReveal(element) {
    element.classList.add("strike-reveal");
    
    // Remove class after animation completes
    setTimeout(() => {
      element.classList.remove("strike-reveal");
    }, 600);
  }
  
  /**
   * Staggers animations with a delay between each
   * @param {Array} elements - Array of elements or data for animations
   * @param {Function} animateFunc - Function to call for each element
   * @param {number} delay - Delay between animations in ms
   * @returns {Promise} - Resolves when all animations are complete
   */
  export function staggerAnimations(elements, animateFunc, delay = 300) {
    const totalTime = elements.length * delay;
    
    elements.forEach((element, index) => {
      setTimeout(() => {
        animateFunc(element, index);
      }, index * delay);
    });
    
    return new Promise(resolve => setTimeout(resolve, totalTime));
  }