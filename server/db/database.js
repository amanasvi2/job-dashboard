const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '../../data/jobs.db');

const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company TEXT NOT NULL,
    job_title TEXT NOT NULL,
    application_date TEXT,
    status TEXT DEFAULT 'Applied',
    notes TEXT DEFAULT '',
    job_posting_url TEXT DEFAULT '',
    salary_range TEXT DEFAULT '',
    contact_name TEXT DEFAULT '',
    contact_email TEXT DEFAULT '',
    next_follow_up TEXT,
    interview_link TEXT DEFAULT '',
    source TEXT DEFAULT 'manual',
    gmail_message_id TEXT UNIQUE,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS gmail_sync_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sync_date TEXT DEFAULT (datetime('now')),
    emails_scanned INTEGER DEFAULT 0,
    jobs_imported INTEGER DEFAULT 0,
    jobs_updated INTEGER DEFAULT 0,
    jobs_skipped INTEGER DEFAULT 0,
    unclassified INTEGER DEFAULT 0,
    details TEXT DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS gmail_tokens (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    access_token TEXT,
    refresh_token TEXT,
    expiry_date INTEGER,
    updated_at TEXT DEFAULT (datetime('now'))
  );
`);

// Migrate: add new columns if they don't exist yet
const migrations = [
  `ALTER TABLE jobs ADD COLUMN status_changed_date TEXT`,
  `ALTER TABLE jobs ADD COLUMN last_email_date TEXT`,
  `ALTER TABLE jobs ADD COLUMN confidence TEXT DEFAULT 'High'`,
  `ALTER TABLE jobs ADD COLUMN needs_review INTEGER DEFAULT 0`,
  `ALTER TABLE gmail_sync_log ADD COLUMN jobs_updated INTEGER DEFAULT 0`,
  `ALTER TABLE gmail_sync_log ADD COLUMN unclassified INTEGER DEFAULT 0`,
];

for (const sql of migrations) {
  try { db.exec(sql); } catch (_) { /* column already exists */ }
}

module.exports = db;
