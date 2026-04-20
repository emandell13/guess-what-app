const express = require('express');
const router = express.Router();
const supabase = require('../../config/supabase');
const {
  replenishPipeline,
  getUpcomingQuestions,
  TARGET_POOL_SIZE
} = require('../../services/contentEngine');

// Manually trigger the content replenishment pipeline.
router.post('/replenish', async (req, res) => {
  try {
    const result = await replenishPipeline();
    res.json({
      success: true,
      generated: result.generated,
      seeded: result.seeded,
      poolSize: result.poolSize,
      created: (result.created || []).map(q => ({
        id: q.id,
        question_text: q.question_text,
        active_date: q.active_date,
        status: q.status
      }))
    });
  } catch (error) {
    console.error('Error running content replenishment:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Health + leaderboard: candidates and scheduled questions, each with their
// impression and pick counts so the admin can see the pool's state at a glance.
router.get('/pipeline-status', async (req, res) => {
  try {
    const upcoming = await getUpcomingQuestions();

    // Aggregate pick counts in one round-trip.
    const ids = upcoming.map(q => q.id);
    let pickCounts = {};
    if (ids.length > 0) {
      const { data: pickRows, error: picksError } = await supabase
        .from('question_picks')
        .select('question_id')
        .in('question_id', ids);
      if (picksError) {
        console.error('pipeline-status: pick count query failed:', picksError);
      } else {
        (pickRows || []).forEach(r => {
          pickCounts[r.question_id] = (pickCounts[r.question_id] || 0) + 1;
        });
      }
    }

    const candidatePoolSize = upcoming.filter(q => q.status === 'candidate').length;

    res.json({
      target_pool_size: TARGET_POOL_SIZE,
      candidate_pool_size: candidatePoolSize,
      upcoming_count: upcoming.length,
      upcoming: upcoming.map(q => ({
        id: q.id,
        question_text: q.question_text,
        active_date: q.active_date,
        status: q.status,
        source: q.source || 'manual',
        impression_count: q.impression_count || 0,
        pick_count: pickCounts[q.id] || 0,
        created_at: q.created_at
      }))
    });
  } catch (error) {
    console.error('Error fetching pipeline status:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
