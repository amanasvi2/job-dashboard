const express = require('express');
const { google } = require('googleapis');
const { getAuthUrl, exchangeCode, getAuthedClient, getStoredTokens, revokeAccess } = require('../services/gmailService');
const { parseEmail, normalizeCompany, STATUS_RANK } = require('../services/emailParser');
const db = require('../db/database');

const router = express.Router();

// ─── Auth status ──────────────────────────────────────────────────────────────

router.get('/status', (_req, res) => {
  const tokens = getStoredTokens();
  const gmailReady = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  res.json({ connected: !!tokens?.access_token, configured: gmailReady });
});

router.get('/auth-url', (_req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(503).json({ error: 'Google OAuth credentials not configured. Check your .env file.' });
  }
  res.json({ url: getAuthUrl() });
});

router.get('/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error) return res.redirect(`http://localhost:5173/gmail?error=${encodeURIComponent(error)}`);
  if (!code) return res.redirect('http://localhost:5173/gmail?error=no_code');
  try {
    await exchangeCode(code);
    res.redirect('http://localhost:5173/gmail?connected=true');
  } catch (e) {
    res.redirect(`http://localhost:5173/gmail?error=${encodeURIComponent(e.message)}`);
  }
});

router.post('/disconnect', async (_req, res) => {
  await revokeAccess();
  res.json({ success: true });
});

// ─── Company matching ─────────────────────────────────────────────────────────

function findMatchingJob(company, jobTitle) {
  const normTarget = normalizeCompany(company);
  if (!normTarget) return null;

  const allJobs = db.prepare('SELECT * FROM jobs').all();
  const companyMatches = allJobs.filter(j => normalizeCompany(j.company) === normTarget);

  if (companyMatches.length === 0) return null;
  if (companyMatches.length === 1) return companyMatches[0];

  // Multiple jobs at same company — try title match
  const normTitle = jobTitle.toLowerCase();
  const titleMatch = companyMatches.find(j =>
    normTitle && j.job_title.toLowerCase().includes(normTitle.split(' ')[0])
  );
  // Return title match or most recently updated
  return titleMatch || companyMatches.sort((a, b) =>
    new Date(b.updated_at) - new Date(a.updated_at)
  )[0];
}

function canUpgradeStatus(current, proposed) {
  const currentRank = STATUS_RANK[current] || 0;
  const proposedRank = STATUS_RANK[proposed] || 0;
  // Never downgrade. Rejected can always override (it's terminal).
  if (proposed === 'Rejected') return currentRank < 5; // can't reject after offer
  return proposedRank > currentRank;
}

// ─── Main sync ────────────────────────────────────────────────────────────────

router.post('/sync', async (_req, res) => {
  const auth = await getAuthedClient();
  if (!auth) return res.status(401).json({ error: 'Gmail not connected' });

  const gmail = google.gmail({ version: 'v1', auth });
  const after = Math.floor((Date.now() - 90 * 24 * 60 * 60 * 1000) / 1000);

  // Broad query covering all stages
  const query = [
    `after:${after}`,
    '(',
    // Application confirmations
    'subject:("application received") OR',
    'subject:("thank you for applying") OR',
    'subject:("thanks for applying") OR',
    'subject:("application confirmation") OR',
    'subject:("application submitted") OR',
    'subject:("we received your application") OR',
    'subject:("you\'ve applied") OR',
    // Rejections
    'subject:("not moving forward") OR',
    'subject:("after careful consideration") OR',
    'subject:("other candidates") OR',
    'subject:("your application") OR',
    // Interviews
    'subject:("phone screen") OR',
    'subject:("technical interview") OR',
    'subject:("coding challenge") OR',
    'subject:("online assessment") OR',
    'subject:("final round") OR',
    'subject:("on-site") OR',
    'subject:("interview") OR',
    // Offers
    'subject:("offer letter") OR',
    'subject:("pleased to offer") OR',
    // Known ATS senders
    'from:greenhouse.io OR',
    'from:lever.co OR',
    'from:hire.lever.co OR',
    'from:linkedin.com OR',
    'from:workday.com OR',
    'from:myworkdayjobs.com OR',
    'from:handshake.com OR',
    'from:joinhandshake.com OR',
    'from:indeed.com OR',
    'from:glassdoor.com OR',
    'from:smartrecruiters.com OR',
    'from:ashbyhq.com OR',
    'from:ashby.io OR',
    'from:jobvite.com OR',
    'from:icims.com OR',
    'from:taleo.net OR',
    'from:workable.com',
    ')',
  ].join(' ');

  let allMessageIds = [];
  let pageToken;

  try {
    do {
      const listRes = await gmail.users.messages.list({
        userId: 'me', q: query, maxResults: 100,
        ...(pageToken && { pageToken }),
      });
      allMessageIds.push(...(listRes.data.messages || []));
      pageToken = listRes.data.nextPageToken;
    } while (pageToken && allMessageIds.length < 500);
  } catch (e) {
    return res.status(500).json({ error: 'Failed to list emails: ' + e.message });
  }

  const results = {
    scanned: allMessageIds.length,
    imported: 0,
    updated: 0,
    skipped: 0,
    unclassified: 0,
    details: [],
  };

  const insertJob = db.prepare(`
    INSERT OR IGNORE INTO jobs
      (company, job_title, application_date, status, source, gmail_message_id,
       interview_link, notes, confidence, needs_review, last_email_date, status_changed_date)
    VALUES
      (@company, @job_title, @application_date, @status, @source, @gmail_message_id,
       @interview_link, @notes, @confidence, @needs_review, @last_email_date, @status_changed_date)
  `);

  const updateJobStatus = db.prepare(`
    UPDATE jobs SET
      status = @status,
      confidence = @confidence,
      needs_review = @needs_review,
      last_email_date = @last_email_date,
      interview_link = CASE WHEN @interview_link != '' THEN @interview_link ELSE interview_link END,
      status_changed_date = @status_changed_date,
      updated_at = datetime('now')
    WHERE id = @id
  `);

  const touchEmailDate = db.prepare(`
    UPDATE jobs SET last_email_date = @last_email_date, updated_at = datetime('now')
    WHERE id = @id
  `);

  for (const { id } of allMessageIds) {
    // Skip already-processed message IDs
    const alreadyProcessed = db.prepare('SELECT id FROM jobs WHERE gmail_message_id = ?').get(id);
    if (alreadyProcessed) {
      results.skipped++;
      results.details.push({ id, outcome: 'duplicate_email', reason: 'Message already imported' });
      continue;
    }

    let msgData;
    try {
      const msgRes = await gmail.users.messages.get({ userId: 'me', id, format: 'full' });
      msgData = msgRes.data;
    } catch (e) {
      results.skipped++;
      results.details.push({ id, outcome: 'error', reason: e.message });
      continue;
    }

    const parsed = parseEmail(msgData);

    if (!parsed) {
      results.skipped++;
      results.details.push({ id, outcome: 'ignored', reason: 'Not a job application email' });
      continue;
    }

    if (parsed.ignored) {
      results.skipped++;
      results.details.push({ id, outcome: 'ignored', reason: parsed.reason });
      continue;
    }

    // Unclassified — low confidence, needs manual review
    if (parsed.needs_review && parsed.status === 'Applied' && parsed.confidence === 'Low') {
      results.unclassified++;
    }

    // Try to match an existing job entry by company name
    const existingJob = findMatchingJob(parsed.company, parsed.job_title);

    if (existingJob) {
      const canUpgrade = canUpgradeStatus(existingJob.status, parsed.status);

      if (canUpgrade) {
        updateJobStatus.run({
          id: existingJob.id,
          status: parsed.status,
          confidence: parsed.confidence,
          needs_review: parsed.needs_review,
          last_email_date: parsed.last_email_date,
          interview_link: parsed.interview_link || '',
          status_changed_date: parsed.last_email_date,
        });
        results.updated++;
        results.details.push({
          id,
          outcome: 'updated',
          company: existingJob.company,
          role: existingJob.job_title,
          previousStatus: existingJob.status,
          newStatus: parsed.status,
          confidence: parsed.confidence,
          needsReview: !!parsed.needs_review,
        });
      } else {
        // Just update last_email_date without changing status
        touchEmailDate.run({ id: existingJob.id, last_email_date: parsed.last_email_date });
        results.skipped++;
        results.details.push({
          id,
          outcome: 'no_upgrade',
          company: existingJob.company,
          role: existingJob.job_title,
          currentStatus: existingJob.status,
          proposedStatus: parsed.status,
          reason: `Status would downgrade (${existingJob.status} → ${parsed.status})`,
        });
      }
    } else {
      // New job entry
      const today = new Date().toISOString().split('T')[0];
      const result = insertJob.run({
        ...parsed,
        status_changed_date: parsed.application_date || today,
      });

      if (result.changes > 0) {
        results.imported++;
        results.details.push({
          id,
          outcome: 'imported',
          company: parsed.company,
          role: parsed.job_title,
          status: parsed.status,
          confidence: parsed.confidence,
          needsReview: !!parsed.needs_review,
        });
      }
    }
  }

  db.prepare(`
    INSERT INTO gmail_sync_log
      (emails_scanned, jobs_imported, jobs_updated, jobs_skipped, unclassified, details)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    results.scanned, results.imported, results.updated,
    results.skipped, results.unclassified, JSON.stringify(results.details)
  );

  res.json(results);
});

// ─── Confirm / dismiss a low-confidence review flag ───────────────────────────
router.post('/confirm/:jobId', (req, res) => {
  const { status } = req.body;
  const existing = db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.jobId);
  if (!existing) return res.status(404).json({ error: 'Job not found' });

  db.prepare(`
    UPDATE jobs SET
      needs_review = 0,
      confidence = 'High',
      status = COALESCE(@status, status),
      updated_at = datetime('now')
    WHERE id = @id
  `).run({ id: req.params.jobId, status: status || existing.status });

  res.json(db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.jobId));
});

// ─── Sync history ─────────────────────────────────────────────────────────────
router.get('/sync-history', (_req, res) => {
  const logs = db.prepare('SELECT * FROM gmail_sync_log ORDER BY sync_date DESC LIMIT 10').all();
  res.json(logs.map(l => ({ ...l, details: JSON.parse(l.details || '[]') })));
});

module.exports = router;
