const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const GIFEncoder = require('gif-encoder-2');
const { PNG } = require('pngjs');

/**
 * Service for generating GIFs of social share templates
 */
const gifService = {
    /**
     * Generate a GIF of the animated social share template
     * @param {string} url - URL of the share template
     * @returns {Promise<string>} - Path to the saved GIF
     */
    async generateGif(url) {
        // Create directories if they don't exist
        const uploadsDir = path.join(__dirname, '../../frontend/uploads');
        const tempDir = path.join(__dirname, '../../temp');

        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }

        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const timestamp = Date.now();
        const framesDir = path.join(tempDir, `frames_${timestamp}`);

        if (!fs.existsSync(framesDir)) {
            fs.mkdirSync(framesDir, { recursive: true });
        }

        const gifFilename = `reel_${timestamp}.gif`;
        const gifPath = path.join(uploadsDir, gifFilename);

        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
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

            while (frameCount < maxFrameCount && !animationComplete) {
                const framePath = path.join(framesDir, `frame_${frameCount.toString().padStart(5, '0')}.png`);
                await page.screenshot({ path: framePath, type: 'png' });
                framePaths.push(framePath);
                
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
            const writeStream = fs.createWriteStream(gifPath);
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

            // Clean up the frames directory
            fs.rm(framesDir, { recursive: true, force: true }, (err) => {
                if (err) console.error('Error removing temporary frames:', err);
            });

            return `/uploads/${gifFilename}`;
        } catch (error) {
            console.error('Error in GIF generation:', error);
            throw error;
        } finally {
            await browser.close();
        }
    }
};

module.exports = gifService;