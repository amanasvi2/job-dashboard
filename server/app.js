require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');

const jobsRouter = require('./routes/jobs');
const gmailRouter = require('./routes/gmail');
const statsRouter = require('./routes/stats');

const app = express();
const PORT = process.env.PORT || 3001;

// Warn about missing env vars at startup
const REQUIRED_FOR_GMAIL = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'];
const missing = REQUIRED_FOR_GMAIL.filter(k => !process.env[k]);
if (missing.length) {
  console.warn(`\n⚠  Gmail sync disabled — missing env vars: ${missing.join(', ')}`);
  console.warn('   Copy .env.example → .env and add your Google OAuth credentials.\n');
} else {
  console.log('✓  Google OAuth credentials loaded');
}

app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/jobs', jobsRouter);
app.use('/api/gmail', gmailRouter);
app.use('/api/stats', statsRouter);

app.get('/health', (_req, res) => res.json({
  status: 'ok',
  gmailConfigured: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
}));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
