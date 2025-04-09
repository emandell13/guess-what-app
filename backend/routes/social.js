const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { getTodayDate, formatDateForDisplay } = require('../utils/dateUtils');
const path = require('path');

// Route to view the social share template (used by video generation)
router.get('/preview', async (req, res) => {
  try {
    // Get yesterday's date
    const date = new Date();
    date.setDate(date.getDate() - 1);
    const yesterdayDate = date.toISOString().split('T')[0]; // Format: YYYY-MM-DD
    const displayDate = formatDateForDisplay(yesterdayDate);
    
    // Get yesterday's question data
    const { data: question, error: questionError } = await supabase
      .from('questions')
      .select('*')
      .eq('active_date', yesterdayDate)
      .eq('voting_complete', true)
      .single();
      
    if (questionError || !question) {
      return res.status(404).json({ error: 'No question available for yesterday' });
    }
    
    // Get the top answers for this question
    const { data: answers, error: answersError } = await supabase
      .from('top_answers')
      .select('*')
      .eq('question_id', question.id)
      .lte('rank', 5)  // Get only the top 5 answers
      .order('rank', { ascending: true });
      
    if (answersError) {
      return res.status(500).json({ error: 'Failed to fetch answers' });
    }
    
    // Calculate total votes to compute percentages for points
    const totalVotes = answers.reduce((sum, answer) => sum + answer.vote_count, 0);
    
    // Format the answers with points
    const formattedAnswers = answers.map(answer => ({
      rank: answer.rank,
      answer: answer.answer,
      points: Math.round((answer.vote_count / totalVotes) * 100)
    }));
    
    // Set the data for the template
    const shareData = {
      date: displayDate,
      question: question.question_text,
      questionWithCount: `What did ${totalVotes} people say was ${question.guess_prompt}`,
      answers: formattedAnswers
    };
    
    // Return the data as JSON (temporary approach)
    res.json({ shareData });
  } catch (error) {
    console.error('Error generating social share preview:', error);
    res.status(500).json({ error: 'Failed to generate social share preview' });
  }
});

module.exports = router;