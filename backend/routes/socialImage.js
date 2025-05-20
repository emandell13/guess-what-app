const express = require('express');
const router = express.Router();
const multer = require('multer');
const supabase = require('../config/supabase');
const { getTodayDate } = require('../utils/dateUtils');
const path = require('path');

// Set up multer for memory storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // Limit to 5MB
    }
});

// Upload social image endpoint (no auth)
router.post('/upload', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No image file provided'
            });
        }

        const today = getTodayDate();
        const filename = `social-image-${today}.png`;
        
        // Upload to Supabase Storage
        const { data, error } = await supabase.storage
            .from('social-assets')
            .upload(filename, req.file.buffer, {
                contentType: 'image/png',
                upsert: true // Overwrite if exists
            });
            
        if (error) {
            console.error('Error uploading to storage:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to upload image to storage'
            });
        }
        
        // Get public URL
        const { publicURL, error: urlError } = supabase.storage
            .from('social-assets')
            .getPublicUrl(filename);
            
        if (urlError) {
            console.error('Error getting public URL:', urlError);
            return res.status(500).json({
                success: false,
                error: 'Failed to get public URL for uploaded image'
            });
        }
        
        // Save image metadata to database
        const { error: dbError } = await supabase
            .from('social_images')
            .insert([
                {
                    date: today,
                    filename,
                    public_url: publicURL
                }
            ]);
            
        if (dbError) {
            console.error('Error saving to database:', dbError);
            // Continue anyway since the image is already uploaded
        }
        
        return res.json({
            success: true,
            message: 'Image uploaded successfully',
            publicUrl: publicURL
        });
    } catch (error) {
        console.error('Error processing image upload:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Failed to process image upload'
        });
    }
});

// Endpoint to get today's data for social image (no auth)
router.get('/today-data', async (req, res) => {
    try {
        // Get today's date
        const today = getTodayDate();
        console.log('Today date:', today);

        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayFormatted = yesterday.toISOString().split('T')[0]; // Format as YYYY-MM-DD
        console.log('Yesterday formatted:', yesterdayFormatted);

        // Get yesterday's question
        const { data: question, error: questionError } = await supabase
            .from('questions')
            .select('*')
            .eq('active_date', yesterdayFormatted)
            .eq('voting_complete', true)
            .single();

        if (questionError) {
            console.error('Error fetching yesterday\'s question:', questionError);
            return res.status(404).json({
                success: false,
                error: 'No question found for yesterday'
            });
        }

        // Get top answers for this question
        const { data: topAnswers, error: answersError } = await supabase
            .from('top_answers')
            .select('*')
            .eq('question_id', question.id)
            .order('rank', { ascending: true });

        if (answersError) {
            console.error('Error fetching top answers:', answersError);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch top answers'
            });
        }

        // Get total votes for this question
        const { count, error: countError } = await supabase
            .from('votes')
            .select('*', { count: 'exact', head: true })
            .eq('question_id', question.id);

        if (countError) {
            console.error('Error fetching vote count:', countError);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch vote count'
            });
        }

        // Format the answers for the frontend
        const formattedAnswers = topAnswers.map(answer => ({
            answer: answer.answer,
            voteCount: answer.vote_count
        }));

        return res.json({
            success: true,
            questionId: question.id,
            question: question.question_text,
            guessPrompt: question.guess_prompt,
            totalVotes: count,
            answers: formattedAnswers,
            date: yesterdayFormatted
        });
    } catch (error) {
        console.error('Error getting yesterday\'s data:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Failed to get yesterday\'s data'
        });
    }
});

module.exports = router;