/**
 * Utility functions for managing visitors in the Guess What game
 */
import { getTodayDate, getTomorrowDate } from './dateUtils.js';

// Generate a random visitor ID using UUID
function generateVisitorId() {
  return crypto.randomUUID(); // Modern browsers support this natively
}

// Get the current visitor ID or create a new one
export function getVisitorId() {
  let visitorId = localStorage.getItem('gwVisitorId');
  
  if (!visitorId) {
    visitorId = generateVisitorId();
    localStorage.setItem('gwVisitorId', visitorId);
  }
  
  return visitorId;
}

// Check if a user has already voted for tomorrow's question
export function hasVotedForTomorrow() {
  const tomorrow = getTomorrowDate();
  return localStorage.getItem(`gwVoted_${tomorrow}`) === 'true';
}

// Mark that a user has voted for tomorrow's question
export function markTomorrowVoted() {
  const tomorrow = getTomorrowDate();
  localStorage.setItem(`gwVoted_${tomorrow}`, 'true');
}

// Save guesses for today (to track daily progress)
export function saveTodayGuesses(guesses) {
  const today = getTodayDate();
  localStorage.setItem(`gwGuesses_${today}`, JSON.stringify(guesses));
}

// Get guesses for today
export function getTodayGuesses() {
  const today = getTodayDate();
  const guessesString = localStorage.getItem(`gwGuesses_${today}`);
  return guessesString ? JSON.parse(guessesString) : [];
}

// Mark today as completed
export function markTodayCompleted() {
  const today = getTodayDate();
  const completedDates = getCompletedDates();
  
  if (!completedDates.includes(today)) {
    completedDates.push(today);
    localStorage.setItem('gwCompletedDates', JSON.stringify(completedDates));
  }
}

// Check if a user has completed today's question
export function hasTodayBeenCompleted() {
  const today = getTodayDate();
  const completedDates = getCompletedDates();
  return completedDates.includes(today);
}

// Get all dates the user has completed a question
export function getCompletedDates() {
  const datesString = localStorage.getItem('gwCompletedDates');
  return datesString ? JSON.parse(datesString) : [];
}

// Save strikes for today
export function saveTodayStrikes(strikes) {
  const today = getTodayDate();
  localStorage.setItem(`gwStrikes_${today}`, strikes.toString());
}

// Get strikes for today
export function getTodayStrikes() {
  const today = getTodayDate();
  const strikesString = localStorage.getItem(`gwStrikes_${today}`);
  return strikesString ? parseInt(strikesString, 10) : 0;
}

// Save the gave up state for today
export function markTodayGaveUp() {
  const today = getTodayDate();
  localStorage.setItem(`gwGaveUp_${today}`, 'true');
}

// Check if user gave up today
export function hasTodayGivenUp() {
  const today = getTodayDate();
  return localStorage.getItem(`gwGaveUp_${today}`) === 'true';
}