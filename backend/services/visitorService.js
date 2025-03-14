const supabase = require('../config/supabase');

/**
 * Ensures a visitor record exists for the given visitorId and
 * associates it with a user if appropriate
 * 
 * @param {string} visitorId - The visitor's UUID
 * @param {string|null} userId - The authenticated user's ID, if available
 * @returns {Promise<Object>} - The visitor record
 */
async function ensureVisitorExists(visitorId, userId = null) {
    if (!visitorId) {
        return null;
    }
    
    const now = new Date().toISOString();
    
    try {
        // Check if visitor exists
        const { data: existingVisitor, error: queryError } = await supabase
            .from('visitors')
            .select('id, user_id, first_seen_at')
            .eq('id', visitorId)
            .single();
            
        if (queryError && queryError.code !== 'PGRST116') { // Error other than "not found"
            console.error('Error checking visitor:', queryError);
            return null;
        }
        
        // If visitor doesn't exist, create a new record
        if (!existingVisitor) {
            const { data: newVisitor, error: insertError } = await supabase
                .from('visitors')
                .insert([{
                    id: visitorId,
                    user_id: userId || null,
                    first_seen_at: now,
                    last_seen_at: now
                }])
                .select()
                .single();
                
            if (insertError) {
                console.error('Error creating visitor record:', insertError);
                return null;
            }
            
            console.log(`Created new visitor record for ${visitorId}`);
            return newVisitor;
        }
        
        // Always update the last_seen_at timestamp
        const updateData = { last_seen_at: now };
        
        // If visitor exists but doesn't have a user_id (and we have one), update the user_id too
        if (userId && !existingVisitor.user_id) {
            updateData.user_id = userId;
        }
        
        const { data: updatedVisitor, error: updateError } = await supabase
            .from('visitors')
            .update(updateData)
            .eq('id', visitorId)
            .select()
            .single();
            
        if (updateError) {
            console.error('Error updating visitor:', updateError);
            return existingVisitor;
        }
        
        if (userId && !existingVisitor.user_id) {
            console.log(`Linked visitor ${visitorId} to user ${userId}`);
        }
        
        return updatedVisitor;
    } catch (error) {
        console.error('Unexpected error in visitor service:', error);
        return null;
    }
}


/**
 * Associates an anonymous visitor with a user
 * This is for when a user authenticates and we want to link their past activity
 * 
 * @param {string} visitorId - The visitor's UUID
 * @param {string} userId - The authenticated user's ID
 * @returns {Promise<boolean>} - Whether the operation was successful
 */
async function associateVisitorWithUser(visitorId, userId) {
    if (!visitorId || !userId) {
        return false;
    }
    
    try {
        // Update the visitor record
        const { error: visitorError } = await supabase
            .from('visitors')
            .update({ user_id: userId })
            .eq('id', visitorId);
            
        if (visitorError) {
            console.error('Error updating visitor record:', visitorError);
            return false;
        }
        
        // Update all votes with this visitor_id to also have the user_id
        const { error: votesError } = await supabase
            .from('votes')
            .update({ user_id: userId })
            .eq('visitor_id', visitorId)
            .is('user_id', null);
            
        if (votesError) {
            console.error('Error updating votes:', votesError);
        }
        
        // Update all guesses with this visitor_id to also have the user_id
        const { error: guessesError } = await supabase
            .from('guesses')
            .update({ user_id: userId })
            .eq('visitor_id', visitorId)
            .is('user_id', null);
            
        if (guessesError) {
            console.error('Error updating guesses:', guessesError);
        }
        
        // Update all game progress records with this visitor_id to also have the user_id
        const { error: progressError } = await supabase
            .from('user_game_progress')
            .update({ user_id: userId })
            .eq('visitor_id', visitorId)
            .is('user_id', null);
            
        if (progressError) {
            console.error('Error updating game progress:', progressError);
        }
        
        console.log(`Associated visitor ${visitorId} with user ${userId}`);
        return true;
    } catch (error) {
        console.error('Error associating visitor with user:', error);
        return false;
    }
}

module.exports = {
    ensureVisitorExists,
    associateVisitorWithUser
};