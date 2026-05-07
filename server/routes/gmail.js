const express = require('express');
const { google } = require('googleapis');
const { getAuthUrl, exchangeCode, getAuthedClient, getStoredTokens, revokeAccess } = require('../services/gmailService');
const { parseEmail } = require('../services/emailParser');
const db = require('../db/database');

const router = express.Router();

// GET /api/gmail/status
router.get('/status', (_req, res) => {
  const tokens = getStoredTokens();
  res.json({ connected: !!tokens?.access_token });
});

// GET /api/gmail/auth-url
router.get('/auth-url', (_req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(503).json({ error: 'Google OAuth credentials not configured. Check your .env file.' });
  }
  res.json({ url: getAuthUrl() });
});

// GET /api/gmail/callback  (Google redirects here)
router.get('/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error) return res.redirect(`http://localhost:5173/gmail?error=${encodeURIComponent(error)}`);
  if (!code) return res.redirect('http://localhost:5173/gmail?error=no_code');

  try {
    await exchangeCode(code);
    res.redirect('http://localhost:5173/gmail?connected=true');
  } catch (e) {
    console.error('OAuth callback error:', e.message);
    res.redirect(`http://localhost:5173/gmail?error=${encodeURIComponent(e.message)}`);
  }
});

// POST /api/gmail/disconnect
router.post('/disconnect', async (_req, res) => {
  await revokeAccess();
  res.json({ success: true });
});

// POST /api/gmail/sync
router.post('/sync', async (_req, res) => {
  const auth = await getAuthedClient();
  if (!auth) return res.status(401).json({ error: 'Gmail not connected' });

  const gmail = google.gmail({ version: 'v1', auth });

  // Search last 90 days for job-related emails
  const after = Math.floor((Date.now() - 90 * 24 * 60 * 60 * 1000) / 1000);
  const query = [
    `after:${after}`,
    '(',
    'subject:("application received") OR',
    'subject:("thank you for applying") OR',
    'subject:("thanks for applying") OR',
    'subject:("application confirmation") OR',
    'subject:("application submitted") OR',
    'subject:("we received your application") OR',
    'from:greenhouse.io OR',
    'from:lever.co OR',
    'from:linkedin.com OR',
    'from:workday.com OR',
    'from:myworkdayjobs.com OR',
    'from:handshake.com OR',
    'from:joinhandshake.com OR',
    'from:indeed.com OR',
    'from:glassdoor.com OR',
    'from:smartrecruiters.com OR',
    'from:ashbyhq.com',
    ')',
  ].join(' ');

  let allMessageIds = [];
  let pageToken = undefined;

  try {
    do {
      const listRes = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: 100,
        ...(pageToken && { pageToken }),
      });
      const msgs = listRes.data.messages || [];
      allMessageIds.push(...msgs);
      pageToken = listRes.data.nextPageToken;
    } while (pageToken && allMessageIds.length < 500);
  } catch (e) {
    console.error('Gmail list error:', e.message);
    return res.status(500).json({ error: 'Failed to list emails: ' + e.message });
  }

  const results = { scanned: allMessageIds.length, imported: 0, skipped: 0, details: [] };
  const insertJob = db.prepare(`
    INSERT OR IGNORE INTO jobs
      (company, job_title, application_date, status, source, gmail_message_id, interview_link, notes)
    VALUES (@company, @job_title, @application_date, @status, @source, @gmail_message_id, @interview_link, @notes)
  `);

  for (const { id } of allMessageIds) {
    try {
      const msgRes = await gmail.users.messages.get({
        userId: 'me',
        id,
        format: 'full',
      });

      const parsed = parseEmail(msgRes.data);
      if (!parsed) {
        results.skipped++;
        results.details.push({ id, status: 'skipped', reason: 'Not recognized as job application' });
        continue;
      }

      // Check if already imported
      const exists = db.prepare('SELECT id FROM jobs WHERE gmail_message_id = ?').get(id);
      if (exists) {
        results.skipped++;
        results.details.push({ id, status: 'duplicate', company: parsed.company, role: parsed.job_title });
        continue;
      }

      const result = insertJob.run(parsed);
      if (result.changes > 0) {
        results.imported++;
        results.details.push({ id, status: 'imported', company: parsed.company, role: parsed.job_title });
      }
    } catch (e) {
      results.skipped++;
      results.details.push({ id, status: 'error', reason: e.message });
    }
  }

  // Log the sync
  db.prepare(`
    INSERT INTO gmail_sync_log (emails_scanned, jobs_imported, jobs_skipped, details)
    VALUES (?, ?, ?, ?)
  `).run(results.scanned, results.imported, results.skipped, JSON.stringify(results.details));

  res.json(results);
});

// GET /api/gmail/sync-history
router.get('/sync-history', (_req, res) => {
  const logs = db.prepare('SELECT * FROM gmail_sync_log ORDER BY sync_date DESC LIMIT 10').all();
  res.json(logs.map(l => ({ ...l, details: JSON.parse(l.details || '[]') })));
});

module.exports = router;
