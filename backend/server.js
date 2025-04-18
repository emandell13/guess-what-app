const express = require('express');
const cron = require('node-cron');
const path = require('path'); // Add this line
const app = express();
const port = process.env.PORT || 3000;
const dotenv = require('dotenv');
dotenv.config();

// Import daily update script
const dailyUpdate = require('./scripts/dailyUpdate');

// Serve static files from the frontend directory
app.use(express.static(path.join(__dirname, 'frontend'))); // Add this line

// Setup middleware
require('./middleware')(app);

// Setup routes
require('./routes')(app);
const votesRouter = require('./routes/votes');

app.use('/votes', votesRouter);

// Specific route for social-share.html
app.get('/social-share.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/social-share.html'));
}); // Add this block

// Add cron job for daily updates at midnight ET (5am UTC)
cron.schedule('0 8 * * *', () => {
  console.log('Running scheduled daily update...');
  dailyUpdate()
    .then(result => console.log('Daily update result:', result))
    .catch(err => console.error('Error in daily update:', err));
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Server is running on port ${port}`);
  console.log(`Access it from your mobile at http://192.168.86.250:${port}`);
});