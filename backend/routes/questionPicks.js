// backend/routes/questionPicks.js
//
// Endpoints for the post-completion "Pick your favorite" step.
//   GET  /api/question-picks/candidates?visitorId=...&limit=3
//   POST /api/question-picks  body: { questionId, visitorId }

const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const visitorService = require('../services/visitorService');
const questionPickService = require('../services/questionPickService');

// Pull userId from a Bearer token if present. Mirrors the dance in routes/votes.js.
async function userIdFromAuthHeader(req) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const token = auth.split(' ')[1];
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (!error && data && data.user) return data.user.id;
  } catch (err) {
    console.error('Auth error (non-critical):', err);
  }
  return null;
}

// Up to N candidate questions this voter hasn't picked yet.
router.get('/candidates', async (req, res) => {
  try {
    const visitorId = req.query.visitorId || null;
    const limitRaw = parseInt(req.query.limit, 10);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 10) : 3;
    const userId = await userIdFromAuthHeader(req);

    const candidates = await questionPickService.getCandidatesForVoter({
      visitorId,
      userId,
      limit
    });

    res.json({ candidates });
  } catch (error) {
    console.error('Error fetching candidate questions:', error);
    res.status(500).json({ error: error.message });
  }
});

// Record a favorite pick.
router.post('/', async (req, res) => {
  try {
    const { questionId, visitorId } = req.body;
    if (!questionId) return res.status(400).json({ error: 'questionId is required' });
    if (!visitorId) return res.status(400).json({ error: 'visitorId is required' });

    const userId = await userIdFromAuthHeader(req);

    // Mirrors votes.js — make sure the visitor row exists so foreign-key-ish
    // joins on visitor analytics elsewhere don't dangle.
    await visitorService.ensureVisitorExists(visitorId, userId);

    const result = await questionPickService.recordPick({
      questionId,
      visitorId,
      userId
    });

    res.json({
      message: result.created ? 'Pick recorded' : 'Pick already recorded',
      data: result.pick
    });
  } catch (error) {
    console.error('Error recording pick:', error);
    const status = /required|not found|completed/i.test(error.message) ? 400 : 500;
    res.status(status).json({ error: error.message });
  }
});

module.exports = router;
