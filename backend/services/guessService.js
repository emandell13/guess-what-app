const supabase = require('../config/supabase');

async function handleGuess(guess, question) {
    try {
        // First try to find an existing guess
        const { data: existingGuess } = await supabase
            .from('guesses')
            .select('*')
            .eq('guess', guess)
            .eq('question', question)
            .single();

        if (existingGuess) {
            // If found, increment the count
            const { data } = await supabase
                .from('guesses')
                .update({ count: existingGuess.count + 1 })
                .eq('id', existingGuess.id)
                .select();
        } else {
            // If not found, insert new guess
            const { data } = await supabase
                .from('guesses')
                .insert([{ guess, question, count: 1 }])
                .select();
        }

        // Get top guesses for this question
        const { data: topGuesses } = await supabase
            .from('guesses')
            .select('*')
            .eq('question', question)
            .order('count', { ascending: false })
            .limit(5);

        return topGuesses.map(entry => `${entry.guess} (${entry.count})`);
    } catch (error) {
        console.error('Error handling guess:', error);
        return [];
    }
}

module.exports = { handleGuess };