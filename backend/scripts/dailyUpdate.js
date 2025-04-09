require('dotenv').config();
const supabase = require('../config/supabase');
const { groupSimilarAnswers } = require('../utils/semanticUtils');
const { getTodayDate, getTomorrowDate } = require('../utils/dateUtils');
const { normalizeText } = require('../utils/textUtils'); // Add this missing import
const videoService = require('../services/videoService');
const bufferService = require('../services/bufferService');
const { formatDateForDisplay } = require('../utils/dateUtils');

async function dailyUpdate() {
  console.log('Starting daily update process...');
  
  try {
    // Get dates in ET timezone using date utilities
    const todayDate = getTodayDate();
    
    // Step 1: Find TODAY's question that was in voting phase yesterday
    // (it should have active_date=TODAY and voting_complete=false)
    await tallyVotesForTodaysQuestion(todayDate);

    // Step 2: Prepare tomorrow's question for voting
    const tomorrowDate = getTomorrowDate();
    await prepareTomorrowsQuestion(tomorrowDate);
    
    // Step 3: Generate and share today's results on social media
    await generateAndShareSocialContent(todayDate);
    
    console.log('Daily update completed successfully');
    return { success: true };
  } catch (error) {
    console.error('Error in daily update:', error);
    return { success: false, error: error.message };
  }
}

async function tallyVotesForTodaysQuestion(todayDate) {
  console.log(`Finding question to tally for today (${todayDate})`);
  
  // This is the question that becomes active TODAY but was in voting yesterday
  const { data: question, error: questionError } = await supabase
    .from('questions')
    .select('*')
    .eq('active_date', todayDate)
    .eq('voting_complete', false)
    .single();
    
  if (questionError) {
    console.error('Error finding question:', questionError);
  }
    
  if (!question) {
    console.log('No question found that needs tallying for today');
    return;
  }
  
  console.log(`Tallying votes for today's question: ${question.question_text} (ID: ${question.id})`);
  
  // Get all votes for this question
  const { data: votes, error: votesError } = await supabase
    .from('votes')
    .select('*')
    .eq('question_id', question.id);
    
  if (votesError) {
    console.error('Error fetching votes:', votesError);
  }
    
  if (!votes || votes.length === 0) {
    console.log('No votes found');
    // Mark as complete even with no votes
    const { error: updateError } = await supabase
      .from('questions')
      .update({ voting_complete: true })
      .eq('id', question.id);
      
    if (updateError) {
      console.error('Error marking question as complete:', updateError);
    } else {
      console.log('Question marked as complete (no votes)');
    }
    return;
  }
  
  console.log(`Found ${votes.length} votes`);
  
  // Extract response text from votes
  const voteTexts = votes.map(vote => vote.response);
  
  // Group similar answers using semantic matching
  // Pass the question text as context for better matching
  const { groupedAnswers, voteToAnswerMapping } = await groupSimilarAnswers(voteTexts, { // Change groupedVotes to groupedAnswers
    questionContext: question.question_text
  });
  
  // Convert to array and sort by count
  const sortedVotes = Object.entries(groupedAnswers) // Change groupedVotes to groupedAnswers
    .map(([answer, count]) => ({ answer, count }))
    .sort((a, b) => b.count - a.count);
  
  console.log('Sorted votes after grouping:', sortedVotes);
  
  // Take top 10 answers
  const topAnswers = sortedVotes.slice(0, 10);
  
  console.log('Top answers to insert:', topAnswers);
  
  // Clear any existing top answers first
  const { error: deleteError } = await supabase
    .from('top_answers')
    .delete()
    .eq('question_id', question.id);
    
  if (deleteError) {
    console.error('Error clearing existing top answers:', deleteError);
  }
  
  // Insert into top_answers table
  const insertedAnswers = [];
  for (let i = 0; i < topAnswers.length; i++) {
    const { answer, count } = topAnswers[i];
    const rank = i + 1;
    
    console.log(`Inserting answer #${rank}: "${answer}" with ${count} votes`);
    
    const { data: insertedAnswer, error: insertError } = await supabase
      .from('top_answers')
      .insert([{
        question_id: question.id,
        answer,
        vote_count: count,
        rank
      }])
      .select();
      
    if (insertError) {
      console.error(`Error inserting answer #${rank}:`, insertError);
    } else {
      console.log(`Answer #${rank} inserted:`, insertedAnswer);
      if (insertedAnswer && insertedAnswer.length > 0) {
        insertedAnswers.push(insertedAnswer[0]);
      }
    }
  }
  
  // Update votes with matched_answer_id
  console.log('Updating votes with matched answer IDs...');
  
  // Create a mapping of canonical answers to top_answer IDs
  const answerToIdMap = {};
  insertedAnswers.forEach(answer => {
    answerToIdMap[answer.answer] = answer.id;
  });
  
  // Update each vote with its matched answer ID
  for (const vote of votes) {
    const normalizedVote = normalizeText(vote.response);
    const mappedAnswer = voteToAnswerMapping[normalizedVote];
    
    if (mappedAnswer && answerToIdMap[mappedAnswer]) {
      const matchedAnswerId = answerToIdMap[mappedAnswer];
      
      console.log(`Updating vote: "${vote.response}" -> "${mappedAnswer}" (ID: ${matchedAnswerId})`);
      
      const { error: updateError } = await supabase
        .from('votes')
        .update({ matched_answer_id: matchedAnswerId })
        .eq('id', vote.id);
        
      if (updateError) {
        console.error(`Error updating vote ${vote.id}:`, updateError);
      }
    }
  }
  
  // Mark question as voting complete
  const { error: finalUpdateError } = await supabase
    .from('questions')
    .update({ voting_complete: true })
    .eq('id', question.id);
    
  if (finalUpdateError) {
    console.error('Error marking question as complete:', finalUpdateError);
  } else {
    console.log('Question marked as complete');
  }
    
  console.log(`Tallied ${votes.length} votes into ${topAnswers.length} top answers`);
}

async function prepareTomorrowsQuestion(tomorrowDate) {
  console.log(`Checking for tomorrow's question (${tomorrowDate})`);
  
  // Check if tomorrow's question exists
  const { data: existingTomorrow, error: checkError } = await supabase
    .from('questions')
    .select('*')
    .eq('active_date', tomorrowDate)
    .single();
    
  if (checkError && checkError.code !== 'PGRST116') { // Not found is ok
    console.error('Error checking for tomorrow\'s question:', checkError);
  }
    
  if (existingTomorrow) {
    console.log(`Tomorrow's question already exists: ${existingTomorrow.question_text}`);
    return;
  }
  
  console.log('No question found for tomorrow');
  
  // Here you could add logic to create a default question for tomorrow
  // or send an alert that a question needs to be created
}

// Add this new function to handle social sharing
async function generateAndShareSocialContent() {
  try {
    console.log('Generating social content for Instagram Reels...');
    
    // Get yesterday's date
    const date = new Date();
    date.setDate(date.getDate() - 1);
    const yesterdayDate = date.toISOString().split('T')[0]; // Format: YYYY-MM-DD
    
    // Get yesterday's question data
    const { data: question, error: questionError } = await supabase
      .from('questions')
      .select('*')
      .eq('active_date', yesterdayDate)
      .eq('voting_complete', true)
      .single();
      
    if (questionError || !question) {
      console.log('No question available for today, skipping social sharing');
      return;
    }
    
    // Get the top answers for this question
    const { data: answers, error: answersError } = await supabase
      .from('top_answers')
      .select('*')
      .eq('question_id', question.id)
      .lte('rank', 5)  // Get only the top 5 answers
      .order('rank', { ascending: true });
      
    if (answersError || !answers || answers.length === 0) {
      console.log('No answers available for today, skipping social sharing');
      return;
    }
    
    // Create a temporary file with the share data
    const displayDate = formatDateForDisplay(todayDate);
    
    // Calculate total votes to compute percentages for points
    const totalVotes = answers.reduce((sum, answer) => sum + answer.vote_count, 0);
    
    // Format the answers with points
    const formattedAnswers = answers.map(answer => ({
      rank: answer.rank,
      answer: answer.answer,
      points: Math.round((answer.vote_count / totalVotes) * 100)
    }));
    
    // Getting the base URL for server
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const previewUrl = `${baseUrl}/social/preview`;
    
    console.log('Generating video from template...');
    
    // Generate the video
    const videoPath = await videoService.generateVideo(previewUrl);
    
    if (!videoPath) {
      throw new Error('Failed to generate video for social sharing');
    }
    
    console.log('Video generated successfully:', videoPath);
    
    // Check if we should skip Buffer posting (for testing)
    const skipBuffer = process.env.SKIP_BUFFER_POSTING === 'true';
    
    if (skipBuffer) {
      console.log('Skipping Buffer posting as per configuration');
      return;
    }
    
    // Create caption with question and date
    const caption = `${question.question_text}\n\nPlay today's "Guess What" game at playguesswhat.com`;
    
    console.log('Scheduling post on Buffer...');
    
    // Schedule on Buffer - post tomorrow at 9am PT
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0); // 9am
    
    const scheduledTime = tomorrow.toISOString();
    
    const bufferResult = await bufferService.scheduleReel(
      videoPath,
      caption,
      scheduledTime
    );
    
    if (!bufferResult.success) {
      throw new Error(`Buffer scheduling failed: ${bufferResult.error}`);
    }
    
    console.log('Post scheduled successfully on Buffer for', scheduledTime);
    
    return true;
  } catch (error) {
    console.error('Error in social content generation:', error);
    // Don't throw error to avoid stopping the whole daily update
    return false;
  }
}

module.exports = dailyUpdate;