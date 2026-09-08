// SkillLoop Server - Local Development
// server.js (for running locally with: node server.js)

const dotenv = require('dotenv');
dotenv.config();

const createApp = require('./src/app');

const app = createApp();

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`✓ SkillLoop running on http://localhost:${PORT}`);
  console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
});
