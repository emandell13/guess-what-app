require('dotenv').config();
const supabase = require('../config/supabase');
const { groupSimilarAnswers } = require('../utils/semanticUtils');
const { getTodayDateET, getTomorrowDateET } = require('../utils/dateUtils');
const { normalizeText } = require('../utils/textUtils'); // Add this missing import

async function dailyUpdate() {
  console.log('Starting daily update process...');
  
  try {
    // Get dates in ET timezone using date utilities
    const todayDate = getTodayDateET();
    
    // Step 1: Find TODAY's question that was in voting phase yesterday
    // (it should have active_date=TODAY and voting_complete=false)
    await tallyVotesForTodaysQuestion(todayDate);

    // Step 2: Prepare tomorrow's question for voting
    const tomorrowDate = getTomorrowDateET();
    await prepareTomorrowsQuestion(tomorrowDate);
    
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

module.exports = dailyUpdate;