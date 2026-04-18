// frontend/js/services/PickService.js
//
// Fetches candidate questions and records the player's favorite pick for the
// post-completion "Pick your favorite" step. Mirrors the shape of VoteService.

import { getVisitorId } from '../utils/visitorUtils.js';
import authService from './AuthService.js';
import eventService from './EventService.js';

class PickService {
  /**
   * Fetch up to `limit` candidate questions the current voter hasn't picked.
   * Returns the array of candidates (possibly empty), or null on error.
   */
  async fetchCandidates(limit = 3) {
    try {
      const visitorId = getVisitorId();
      const params = new URLSearchParams({ visitorId, limit: String(limit) });

      const headers = {};
      if (authService.isAuthenticated()) {
        headers.Authorization = `Bearer ${authService.token}`;
      }

      const response = await fetch(`/api/question-picks/candidates?${params.toString()}`, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        eventService.emit('pick:load-error', { error: body.error || 'Failed to load candidates' });
        return null;
      }

      const data = await response.json();
      return Array.isArray(data.candidates) ? data.candidates : [];
    } catch (error) {
      console.error('Error fetching candidate questions:', error);
      eventService.emit('pick:load-error', { error: error.message });
      return null;
    }
  }

  /**
   * Record a favorite pick for the given question.
   */
  async submitPick(questionId) {
    try {
      const visitorId = getVisitorId();

      const headers = { 'Content-Type': 'application/json' };
      if (authService.isAuthenticated()) {
        headers.Authorization = `Bearer ${authService.token}`;
      }

      const response = await fetch('/api/question-picks', {
        method: 'POST',
        headers,
        body: JSON.stringify({ questionId, visitorId })
      });

      const result = await response.json();

      if (response.ok) {
        eventService.emit('pick:submitted', { questionId, ...result });
        return { success: true, data: result };
      }

      eventService.emit('pick:error', { error: result.error || 'Failed to record pick' });
      return { success: false, error: result.error };
    } catch (error) {
      console.error('Error submitting pick:', error);
      eventService.emit('pick:error', { error: error.message });
      return { success: false, error: error.message };
    }
  }
}

const pickService = new PickService();
export default pickService;
