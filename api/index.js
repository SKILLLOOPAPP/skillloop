// SkillLoop Serverless Entry Point
// api/index.js

const dotenv = require('dotenv');
dotenv.config();

const createApp = require('../src/app');

const app = createApp();

module.exports = app;
