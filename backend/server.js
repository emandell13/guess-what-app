const express = require('express');
const cron = require('node-cron'); // Add this line
const app = express();
const port = process.env.PORT || 3000;
const dotenv = require('dotenv');
dotenv.config();

// Import daily update script
const dailyUpdate = require('./scripts/dailyUpdate'); // Add this line

// Setup middleware
require('./middleware')(app);

// Setup routes
require('./routes')(app);
const votesRouter = require('./routes/votes');

app.use('/votes', votesRouter);

// Add cron job for daily updates at midnight ET (5am UTC)
cron.schedule('0 8 * * *', () => {
  console.log('Running scheduled daily update...');
  dailyUpdate()
    .then(result => console.log('Daily update result:', result))
    .catch(err => console.error('Error in daily update:', err));
});

const os = require('os');

// Function to get local IP address
function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (let name in interfaces) {
    for (let iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost'; // Fallback
}

app.listen(port, '0.0.0.0', () => {
  const localIp = getLocalIp();
  console.log(`Server is running on port ${port}`);
  console.log(`Access it from your mobile at http://${localIp}:${port}`);
});