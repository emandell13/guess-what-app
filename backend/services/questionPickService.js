// backend/services/questionPickService.js
//
// Powers the post-completion "Pick your favorite" step (3 candidate questions
// shown, one tap to favorite). Each pick is recorded against (question, voter)
// with a unique constraint so the same voter never sees a question they've
// already picked again.

const supabase = require('../config/supabase');

const DEFAULT_LIMIT = 3;

/**
 * Returns up to `limit` candidate questions this voter hasn't yet picked,
 * prioritized by fewest total picks across all voters (so signal distributes
 * evenly across the pool). Ties broken randomly so the same player doesn't
 * see an identical set every session.
 *
 * Voter is identified by visitorId primarily; userId is also matched if
 * provided (handles cross-device account-holders without losing the rule).
 */
async function getCandidatesForVoter({ visitorId = null, userId = null, limit = DEFAULT_LIMIT } = {}) {
  // 1. Current candidates with their impression counts.
  const { data: candidates, error: candidatesError } = await supabase
    .from('questions')
    .select('id, question_text, impression_count')
    .eq('status', 'candidate');

  if (candidatesError) throw candidatesError;
  if (!candidates || candidates.length === 0) return [];

  // 2. Questions this voter already picked (by visitor OR user id).
  let pickedIds = new Set();
  if (visitorId || userId) {
    let query = supabase.from('question_picks').select('question_id');
    if (visitorId && userId) {
      query = query.or(`visitor_id.eq.${visitorId},user_id.eq.${userId}`);
    } else if (visitorId) {
      query = query.eq('visitor_id', visitorId);
    } else {
      query = query.eq('user_id', userId);
    }
    const { data: alreadyPicked, error: pickedError } = await query;
    if (pickedError) {
      console.error('Error fetching voter prior picks (proceeding without exclusion):', pickedError);
    } else {
      pickedIds = new Set((alreadyPicked || []).map(r => r.question_id));
    }
  }

  const eligible = candidates.filter(c => !pickedIds.has(c.id));
  if (eligible.length === 0) return [];

  // 3. Least-shown first; random tiebreak so we don't always show the same
  //    trio to the same viewer-session. Basing serving on impressions (not
  //    picks) gives every candidate fair exposure — a just-picked candidate
  //    doesn't get demoted out of rotation just because someone liked it.
  const sorted = eligible.slice().sort((a, b) => {
    const ia = a.impression_count || 0;
    const ib = b.impression_count || 0;
    if (ia !== ib) return ia - ib;
    return Math.random() - 0.5;
  });

  const chosen = sorted.slice(0, limit);

  // 4. Bump impression counts for the chosen set. Best-effort — a failure
  //    here shouldn't block the response; the voter still sees candidates.
  if (chosen.length > 0) {
    try {
      const { error: rpcError } = await supabase.rpc('increment_impression_counts', {
        question_ids: chosen.map(c => c.id)
      });
      if (rpcError) {
        console.error('increment_impression_counts RPC failed:', rpcError);
      }
    } catch (err) {
      console.error('increment_impression_counts RPC threw:', err);
    }
  }

  return chosen.map(c => ({ id: c.id, question_text: c.question_text }));
}

/**
 * Record a pick. Idempotent — duplicate (question_id, visitor_id) returns
 * the existing row instead of throwing. visitorId required.
 */
async function recordPick({ questionId, visitorId, userId = null }) {
  if (!questionId) throw new Error('questionId is required');
  if (!visitorId) throw new Error('visitorId is required');

  // Don't accept picks on already-completed questions — the signal is moot.
  // Picks on scheduled questions are still useful (post-promotion social
  // signal), so we only block 'completed'.
  const { data: question, error: qError } = await supabase
    .from('questions')
    .select('id, status')
    .eq('id', questionId)
    .single();

  if (qError || !question) {
    throw new Error('Question not found');
  }
  if (question.status === 'completed') {
    throw new Error('Cannot pick a completed question');
  }

  const { data, error } = await supabase
    .from('question_picks')
    .insert([{
      question_id: questionId,
      visitor_id: visitorId,
      user_id: userId
    }])
    .select()
    .single();

  if (error) {
    // 23505 = unique constraint violation. Treat as idempotent success.
    if (error.code === '23505') {
      const { data: existing } = await supabase
        .from('question_picks')
        .select('*')
        .eq('question_id', questionId)
        .eq('visitor_id', visitorId)
        .single();
      return { created: false, pick: existing };
    }
    throw error;
  }

  return { created: true, pick: data };
}

module.exports = {
  getCandidatesForVoter,
  recordPick
};
