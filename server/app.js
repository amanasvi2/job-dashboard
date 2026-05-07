require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const path = require('path');

const jobsRouter = require('./routes/jobs');
const gmailRouter = require('./routes/gmail');
const statsRouter = require('./routes/stats');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/jobs', jobsRouter);
app.use('/api/gmail', gmailRouter);
app.use('/api/stats', statsRouter);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
