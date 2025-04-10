const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const GIFEncoder = require('gif-encoder-2');
const { PNG } = require('pngjs');
const supabase = require('../config/supabase');
const isProd = process.env.NODE_ENV === 'production';

/**
 * Service for generating GIFs and still images of social share templates
 */
const gifService = {
    /**
     * Generate both a GIF and still image of the animated social share template and upload to Supabase
     * @param {string} url - URL of the share template
     * @returns {Promise<Object>} - Public URLs to the saved GIF and still image
     */
    async generateGifAndStillImage(url) {
        // Create temp directory if it doesn't exist
        const tempDir = path.join(__dirname, '../../temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const timestamp = Date.now();
        const framesDir = path.join(tempDir, `frames_${timestamp}`);

        if (!fs.existsSync(framesDir)) {
            fs.mkdirSync(framesDir, { recursive: true });
        }

        const gifFilename = `reel_${timestamp}.gif`;
        const staticImageFilename = `still_${timestamp}.jpg`;
        const localGifPath = path.join(tempDir, gifFilename);
        const staticImagePath = path.join(tempDir, staticImageFilename);


        console.log('Chrome environment variables:');
        console.log(`- CHROME_EXECUTABLE_PATH: ${process.env.CHROME_EXECUTABLE_PATH || 'not set'}`);
        console.log(`- CHROME_PATH: ${process.env.CHROME_PATH || 'not set'}`);
        
        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        try {
            const page = await browser.newPage();

            // Set viewport - using 1080x1350 (4:5 ratio) for Instagram grid compatibility
            await page.setViewport({
                width: 1080,
                height: 1350,
                deviceScaleFactor: 1.5 // Balanced resolution
            });

            console.log('Navigating to URL:', url);

            // Navigate to the URL and wait for content to load
            await page.goto(url, { waitUntil: 'networkidle2' });

            // Capture frames at regular intervals
            const totalDuration = 21500; // Updated total duration
            const frameInterval = 50; // 20 frames per second
            const maxFrameCount = Math.ceil(totalDuration / frameInterval); // Safety maximum
            const framePaths = [];

            console.log('Starting frame capture...');

            // Function to check if the animation is complete
            const checkAnimationComplete = async () => {
                return await page.evaluate(() => {
                    return window.animationComplete === true;
                });
            };

            let frameCount = 0;
            let animationComplete = false;
            let lastFramePath = null;

            while (frameCount < maxFrameCount && !animationComplete) {
                const framePath = path.join(framesDir, `frame_${frameCount.toString().padStart(5, '0')}.png`);
                await page.screenshot({ path: framePath, type: 'png' });
                framePaths.push(framePath);
                lastFramePath = framePath;

                // Calculate progress and check animation status
                if (frameCount % 20 === 0) {
                    console.log(`Captured ${frameCount} frames so far...`);
                    // Check if animation is complete
                    animationComplete = await checkAnimationComplete();
                    if (animationComplete) {
                        console.log('Animation complete detected, stopping capture');
                    }
                }

                // Delay until next frame
                await new Promise(resolve => setTimeout(resolve, frameInterval));
                frameCount++;
            }

            console.log(`Captured ${frameCount} frames, now creating GIF...`);

            // Take a final screenshot for Instagram
            console.log('Taking final static image for Instagram...');
            await page.screenshot({
                path: staticImagePath,
                type: 'jpeg',
                quality: 90 // High quality
            });

            // Load all PNG files into memory
            const pngFrames = [];
            for (const framePath of framePaths) {
                const data = fs.readFileSync(framePath);
                const png = PNG.sync.read(data);
                pngFrames.push(png);
            }

            if (pngFrames.length === 0) {
                throw new Error('No frames were captured');
            }

            // Create GIF using first frame dimensions
            const { width, height } = pngFrames[0];
            const encoder = new GIFEncoder(width, height);

            // Pipe to output file
            const writeStream = fs.createWriteStream(localGifPath);
            encoder.createReadStream().pipe(writeStream);

            // Start encoding
            encoder.start();
            encoder.setDelay(frameInterval);
            encoder.setQuality(10); // Lower number = higher quality
            encoder.setRepeat(0); // 0 = loop indefinitely

            // Add each frame to the GIF
            for (const png of pngFrames) {
                encoder.addFrame(png.data);
            }

            // Finish encoding
            encoder.finish();

            // Wait for the file to be written
            await new Promise((resolve) => {
                writeStream.on('finish', resolve);
            });

            console.log('GIF creation complete');

            // Upload GIF to Supabase Storage
            console.log('Uploading GIF to Supabase Storage...');
            const gifBuffer = fs.readFileSync(localGifPath);

            const { data: gifData, error: gifError } = await supabase.storage
                .from('social-assets')  // Your bucket name
                .upload(gifFilename, gifBuffer, {
                    contentType: 'image/gif',
                    upsert: true
                });

            if (gifError) {
                throw new Error(`Supabase GIF upload failed: ${gifError.message}`);
            }

            // Upload static image to Supabase
            console.log('Uploading static image to Supabase Storage...');
            const staticImageBuffer = fs.readFileSync(staticImagePath);

            const { data: staticImageData, error: staticImageError } = await supabase.storage
                .from('social-assets')  // Same bucket
                .upload(staticImageFilename, staticImageBuffer, {
                    contentType: 'image/jpeg',
                    upsert: true
                });

            if (staticImageError) {
                throw new Error(`Supabase static image upload failed: ${staticImageError.message}`);
            }

            // Get the public URLs
            const { data: gifUrlData } = supabase.storage
                .from('social-assets')
                .getPublicUrl(gifFilename);

            const { data: staticImageUrlData } = supabase.storage
                .from('social-assets')
                .getPublicUrl(staticImageFilename);

            const gifUrl = gifUrlData.publicUrl;
            const staticImageUrl = staticImageUrlData.publicUrl;

            console.log('Media uploaded to Supabase successfully');
            console.log('GIF URL:', gifUrl);
            console.log('Static Image URL:', staticImageUrl);

            // Clean up the frames directory and temporary files
            fs.rm(framesDir, { recursive: true, force: true }, (err) => {
                if (err) console.error('Error removing temporary frames:', err);
            });

            fs.unlink(localGifPath, (err) => {
                if (err) console.error('Error removing temporary GIF file:', err);
            });

            fs.unlink(staticImagePath, (err) => {
                if (err) console.error('Error removing temporary image file:', err);
            });

            return {
                gifUrl,
                staticImageUrl
            };
        } catch (error) {
            console.error('Error in media generation:', error);
            throw error;
        } finally {
            await browser.close();
        }
    },

    /**
     * Generate a GIF of the animated social share template (legacy method)
     * @param {string} url - URL of the share template
     * @returns {Promise<string>} - Public URL to the saved GIF
     */
    async generateGif(url) {
        try {
            const result = await this.generateGifAndStillImage(url);
            return result.gifUrl;
        } catch (error) {
            console.error('Error in GIF generation:', error);
            throw error;
        }
    }
};

module.exports = gifService;