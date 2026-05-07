const express = require('express');
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const db = require('../db/database');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const VALID_STATUSES = ['Applied', 'Phone Screen', 'Technical Interview', 'Final Round', 'Offer', 'Rejected'];

function sanitizeJob(body) {
  const {
    company, job_title, application_date, status, notes,
    job_posting_url, salary_range, contact_name, contact_email,
    next_follow_up, interview_link, source
  } = body;
  return {
    company: company?.trim(),
    job_title: job_title?.trim(),
    application_date: application_date || new Date().toISOString().split('T')[0],
    status: VALID_STATUSES.includes(status) ? status : 'Applied',
    notes: notes || '',
    job_posting_url: job_posting_url || '',
    salary_range: salary_range || '',
    contact_name: contact_name || '',
    contact_email: contact_email || '',
    next_follow_up: next_follow_up || null,
    interview_link: interview_link || '',
    source: source || 'manual',
  };
}

// GET /api/jobs
router.get('/', (req, res) => {
  const { status, search, sort = 'created_at', order = 'DESC' } = req.query;
  const allowed_sorts = ['company', 'job_title', 'application_date', 'status', 'created_at', 'next_follow_up'];
  const sortCol = allowed_sorts.includes(sort) ? sort : 'created_at';
  const sortDir = order === 'ASC' ? 'ASC' : 'DESC';

  let query = 'SELECT * FROM jobs WHERE 1=1';
  const params = [];

  if (status) { query += ' AND status = ?'; params.push(status); }
  if (search) {
    query += ' AND (company LIKE ? OR job_title LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  query += ` ORDER BY ${sortCol} ${sortDir}`;
  res.json(db.prepare(query).all(...params));
});

// GET /api/jobs/:id
router.get('/:id', (req, res) => {
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(job);
});

// POST /api/jobs
router.post('/', (req, res) => {
  const job = sanitizeJob(req.body);
  if (!job.company || !job.job_title) {
    return res.status(400).json({ error: 'company and job_title are required' });
  }
  const result = db.prepare(`
    INSERT INTO jobs (company, job_title, application_date, status, notes, job_posting_url,
      salary_range, contact_name, contact_email, next_follow_up, interview_link, source)
    VALUES (@company, @job_title, @application_date, @status, @notes, @job_posting_url,
      @salary_range, @contact_name, @contact_email, @next_follow_up, @interview_link, @source)
  `).run(job);
  res.status(201).json(db.prepare('SELECT * FROM jobs WHERE id = ?').get(result.lastInsertRowid));
});

// PATCH /api/jobs/:id
router.patch('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Job not found' });

  const merged = { ...existing, ...req.body };
  const job = sanitizeJob(merged);

  db.prepare(`
    UPDATE jobs SET
      company = @company, job_title = @job_title, application_date = @application_date,
      status = @status, notes = @notes, job_posting_url = @job_posting_url,
      salary_range = @salary_range, contact_name = @contact_name, contact_email = @contact_email,
      next_follow_up = @next_follow_up, interview_link = @interview_link,
      updated_at = datetime('now')
    WHERE id = @id
  `).run({ ...job, id: req.params.id });

  res.json(db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id));
});

// DELETE /api/jobs/:id
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM jobs WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Job not found' });
  res.json({ success: true });
});

// POST /api/jobs/import/csv
router.post('/import/csv', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  let records;
  try {
    records = parse(req.file.buffer.toString(), { columns: true, skip_empty_lines: true, trim: true });
  } catch (e) {
    return res.status(400).json({ error: 'Invalid CSV: ' + e.message });
  }

  const insert = db.prepare(`
    INSERT OR IGNORE INTO jobs (company, job_title, application_date, status, notes,
      job_posting_url, salary_range, contact_name, contact_email, next_follow_up, source)
    VALUES (@company, @job_title, @application_date, @status, @notes,
      @job_posting_url, @salary_range, @contact_name, @contact_email, @next_follow_up, @source)
  `);

  let imported = 0;
  const errors = [];

  const importAll = db.transaction(() => {
    for (const row of records) {
      if (!row.company || !row.job_title) {
        errors.push(`Skipped row: missing company or job_title`);
        continue;
      }
      try {
        insert.run(sanitizeJob({ ...row, source: 'csv' }));
        imported++;
      } catch (e) {
        errors.push(`Error on ${row.company}: ${e.message}`);
      }
    }
  });

  importAll();
  res.json({ imported, errors, total: records.length });
});

module.exports = router;
