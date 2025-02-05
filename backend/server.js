const express = require('express');
const app = express();
const port = process.env.PORT || 3000;
const dotenv = require('dotenv');
dotenv.config();

// Setup middleware
require('./middleware')(app);

// Setup routes
require('./routes')(app);
const votesRouter = require('./routes/votes');

app.use('/votes', votesRouter);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});