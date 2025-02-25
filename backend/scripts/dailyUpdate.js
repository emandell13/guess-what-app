require('dotenv').config();
const supabase = require('../config/supabase');

async function dailyUpdate() {
  console.log('Starting daily update process...');
  
  try {
    // Get the dates in ET timezone
    const et = new Date().toLocaleString("en-US", {timeZone: "America/New_York"});
    const etDate = new Date(et);
    
    const todayDate = formatDate(etDate);
    
    // Step 1: Find yesterday's voting question and tally its votes
    await tallyVotesForYesterday(etDate);

    // Step 2: Set today's question to active
    await activateTodaysQuestion(todayDate);
    
    console.log('Daily update completed successfully');
    return { success: true };
  } catch (error) {
    console.error('Error in daily update:', error);
    return { success: false, error: error.message };
  }
}

async function tallyVotesForYesterday(etDate) {
  // Get yesterday's date
  const yesterday = new Date(etDate);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayDate = formatDate(yesterday);
  
  console.log(`Finding voting question for: ${yesterdayDate}`);
  
  // Find yesterday's voting question
  const { data: question, error: questionError } = await supabase
    .from('questions')
    .select('*')
    .eq('active_date', yesterdayDate)
    .eq('voting_complete', false)
    .single();
    
  if (questionError) {
    console.error('Error finding question:', questionError);
  }
    
  if (!question) {
    console.log('No voting question found for yesterday');
    return;
  }
  
  console.log(`Tallying votes for question: ${question.question_text} (ID: ${question.id})`);
  
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
  
  // Count votes by response
  const voteCount = {};
  votes.forEach(vote => {
    const response = vote.response.toLowerCase().trim();
    voteCount[response] = (voteCount[response] || 0) + 1;
  });
  
  console.log('Vote counts:', voteCount);
  
  // Convert to array and sort by count
  const sortedVotes = Object.entries(voteCount)
    .map(([answer, count]) => ({ answer, count }))
    .sort((a, b) => b.count - a.count);
  
  console.log('Sorted votes:', sortedVotes);
  
  // Take top 5 answers (or fewer if not enough votes)
  const topAnswers = sortedVotes.slice(0, Math.min(5, sortedVotes.length));
  
  console.log('Top answers to insert:', topAnswers);
  
  // Insert into top_answers table
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
async function activateTodaysQuestion(todayDate) {
  console.log(`Activating question for: ${todayDate}`);
  
  // Check if today's question exists and is marked as voting_complete: true
  const { data: existingActive } = await supabase
    .from('questions')
    .select('*')
    .eq('active_date', todayDate)
    .single();
    
  if (existingActive) {
    console.log(`Today's question already exists: ${existingActive.question_text}`);
    // No need to do anything, it's already set up
    return;
  }
  
  console.log('No question found for today');
  // You could add logic here to create a default question if none exists
}

function formatDate(date) {
  return date.getFullYear() + '-' + 
    String(date.getMonth() + 1).padStart(2, '0') + '-' + 
    String(date.getDate()).padStart(2, '0');
}

module.exports = dailyUpdate;