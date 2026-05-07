const express = require('express');
const db = require('../db/database');

const router = express.Router();

router.get('/', (_req, res) => {
  const total = db.prepare('SELECT COUNT(*) as count FROM jobs').get().count;

  const byStatus = db.prepare(`
    SELECT status, COUNT(*) as count FROM jobs GROUP BY status
  `).all();

  const responseRate = (() => {
    const responded = db.prepare(`
      SELECT COUNT(*) as count FROM jobs
      WHERE status NOT IN ('Applied', 'Rejected')
    `).get().count;
    const applied = db.prepare(`SELECT COUNT(*) as count FROM jobs WHERE status = 'Applied'`).get().count;
    const total_ = total || 1;
    return Math.round((responded / total_) * 100);
  })();

  const interviewRate = (() => {
    const interviewed = db.prepare(`
      SELECT COUNT(*) as count FROM jobs
      WHERE status IN ('Technical Interview', 'Final Round', 'Offer')
    `).get().count;
    return total ? Math.round((interviewed / total) * 100) : 0;
  })();

  const offerRate = (() => {
    const offers = db.prepare(`SELECT COUNT(*) as count FROM jobs WHERE status = 'Offer'`).get().count;
    return total ? Math.round((offers / total) * 100) : 0;
  })();

  const recentActivity = db.prepare(`
    SELECT id, company, job_title, status, application_date, updated_at, source
    FROM jobs ORDER BY updated_at DESC LIMIT 10
  `).all();

  const upcomingFollowUps = db.prepare(`
    SELECT id, company, job_title, status, next_follow_up
    FROM jobs
    WHERE next_follow_up IS NOT NULL AND next_follow_up >= date('now')
    ORDER BY next_follow_up ASC LIMIT 5
  `).all();

  const applicationsByMonth = db.prepare(`
    SELECT strftime('%Y-%m', application_date) as month, COUNT(*) as count
    FROM jobs
    WHERE application_date IS NOT NULL
    GROUP BY month ORDER BY month DESC LIMIT 6
  `).all().reverse();

  res.json({
    total,
    responseRate,
    interviewRate,
    offerRate,
    byStatus,
    recentActivity,
    upcomingFollowUps,
    applicationsByMonth,
  });
});

module.exports = router;
