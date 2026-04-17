const express = require('express');
const router = express.Router();
const { replenishPipeline, getUpcomingQuestions } = require('../../services/contentEngine');

// Manually trigger the content replenishment pipeline.
router.post('/replenish', async (req, res) => {
  try {
    const result = await replenishPipeline();
    res.json({
      success: true,
      generated: result.generated,
      seeded: result.seeded,
      created: (result.created || []).map(q => ({
        id: q.id,
        question_text: q.question_text,
        active_date: q.active_date
      }))
    });
  } catch (error) {
    console.error('Error running content replenishment:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Lightweight health check: how many upcoming questions are queued?
router.get('/pipeline-status', async (req, res) => {
  try {
    const upcoming = await getUpcomingQuestions();
    res.json({
      upcoming_count: upcoming.length,
      upcoming: upcoming.map(q => ({
        id: q.id,
        question_text: q.question_text,
        active_date: q.active_date,
        source: q.source || 'manual'
      }))
    });
  } catch (error) {
    console.error('Error fetching pipeline status:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
