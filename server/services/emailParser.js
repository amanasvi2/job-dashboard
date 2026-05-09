// ─── Stage definitions — ordered highest-priority first ───────────────────────
const STAGE_RULES = [
  {
    status: 'Offer',
    rank: 5,
    phrases: [
      'offer letter', 'pleased to offer', "we'd like to offer you", "we would like to offer you",
      'compensation package', 'official offer', 'extend an offer', 'job offer',
      'we are excited to offer', 'offer of employment',
    ],
  },
  {
    status: 'Final Round',
    rank: 4,
    phrases: [
      'on-site', 'onsite', 'final round', 'virtual interview loop', 'meet the team',
      'panel interview', 'final interview', 'hiring manager interview', 'final stage',
      'loop interview', 'executive interview', 'meet with the team',
    ],
  },
  {
    status: 'Technical Interview',
    rank: 3,
    phrases: [
      'technical interview', 'coding challenge', 'take-home assignment', 'take home assignment',
      'hackerrank', 'codility', 'technical assessment', 'online assessment', 'coderpad',
      'coding assessment', 'programming challenge', 'technical screen', 'leetcode',
      'karat interview', 'code signal', 'codesignal', ' oa ', '"oa"', 'technical evaluation',
    ],
  },
  {
    status: 'Phone Screen',
    rank: 2,
    phrases: [
      'schedule a call', 'introductory call', 'recruiter would like to connect',
      'phone screen', 'initial interview', "let's find a time", 'find a time to chat',
      'calendly', 'schedule time', 'phone call', 'video call', 'brief call',
      'screening call', 'intro call', 'connect with you', 'chat with you',
      'speak with you', 'first interview', 'initial screen',
    ],
  },
  {
    status: 'Rejected',
    rank: 6,
    phrases: [
      "we've decided to move forward with other candidates",
      "we have decided to move forward with other candidates",
      'not moving forward', "we won't be moving forward", "we will not be moving forward",
      'after careful consideration', 'position has been filled', 'we have decided not to',
      'not selected', 'other candidates whose experience', 'we regret to inform',
      'decided to pursue other candidates', 'not a fit', 'not the right fit',
      'we are unable to move forward', 'chosen not to move forward',
      'unfortunately we', 'unfortunately, we', 'thank you for your interest, however',
    ],
  },
  {
    status: 'Applied',
    rank: 1,
    phrases: [
      'application received', 'thank you for applying', 'thanks for applying',
      'we received your application', 'application submitted', "you've applied",
      'application confirmation', 'your application has been received',
      'your application has been submitted', 'successfully applied',
      'confirming your application', 'application acknowledgment',
    ],
  },
];

const STATUS_RANK = Object.fromEntries(STAGE_RULES.map(r => [r.status, r.rank]));

// ─── ATS sender domains ────────────────────────────────────────────────────────
const ATS_DOMAINS = {
  'greenhouse.io': 'Greenhouse',
  'lever.co': 'Lever',
  'hire.lever.co': 'Lever',
  'workday.com': 'Workday',
  'myworkdayjobs.com': 'Workday',
  'linkedin.com': 'LinkedIn',
  'indeed.com': 'Indeed',
  'glassdoor.com': 'Glassdoor',
  'joinhandshake.com': 'Handshake',
  'handshake.com': 'Handshake',
  'smartrecruiters.com': 'SmartRecruiters',
  'icims.com': 'iCIMS',
  'taleo.net': 'Taleo',
  'successfactors.com': 'SAP SuccessFactors',
  'bamboohr.com': 'BambooHR',
  'jobvite.com': 'Jobvite',
  'ashbyhq.com': 'Ashby',
  'ashby.io': 'Ashby',
  'rippling.com': 'Rippling',
  'workable.com': 'Workable',
  'breezy.hr': 'Breezy',
  'recruitee.com': 'Recruitee',
  'jazz.co': 'JazzHR',
  'dover.com': 'Dover',
};

// Automated digest/promotional emails to ignore (not real job events)
const NOISE_SUBJECTS = [
  'new jobs for you', 'jobs you might like', 'job recommendations', 'jobs matching',
  'weekly digest', 'job alert', 'recommended jobs', 'jobs near you', 'similar jobs',
  'your job feed', 'new job postings', 'daily digest', 'weekly jobs',
  'jobs that match', 'you might be interested', 'explore new opportunities',
  'easy apply', 'view salary', 'complete your profile',
];

const NOISE_SENDERS = [
  'jobalerts@indeed.com', 'alerts@glassdoor.com', 'jobs@linkedin.com',
  'messages-noreply@linkedin.com', 'noreply@linkedin.com',
  'notifications@linkedin.com', 'inmail-hit-reply@linkedin.com',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getSenderDomain(from) {
  const m = from.match(/@([a-zA-Z0-9.-]+)/);
  return m ? m[1].toLowerCase() : '';
}

function getSenderEmail(from) {
  const m = from.match(/<([^>]+)>/) || from.match(/([^\s]+@[^\s]+)/);
  return m ? m[1].toLowerCase() : from.toLowerCase();
}

function getSenderDisplayName(from) {
  const m = from.match(/^"?([^"<]+)"?\s*</);
  return m ? m[1].trim() : '';
}

function decodeBase64Url(str) {
  return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
}

function extractBody(payload) {
  if (!payload) return '';
  if (payload.body?.data) return decodeBase64Url(payload.body.data);

  if (payload.parts) {
    // Prefer plain text
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return decodeBase64Url(part.body.data);
      }
    }
    // Fall back to HTML stripped of tags
    for (const part of payload.parts) {
      if (part.mimeType === 'text/html' && part.body?.data) {
        return decodeBase64Url(part.body.data)
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ');
      }
      // Recurse into multipart
      if (part.parts) {
        const nested = extractBody(part);
        if (nested) return nested;
      }
    }
  }
  return '';
}

function hasCalendarAttachment(payload) {
  if (!payload?.parts) return false;
  return payload.parts.some(p =>
    p.mimeType === 'text/calendar' || p.mimeType === 'application/ics' ||
    (p.filename && p.filename.endsWith('.ics'))
  );
}

function extractCalendarDateTime(body) {
  // Look for DTSTART in ical data
  const m = body.match(/DTSTART[^:]*:(\d{8}T\d{6})/);
  if (m) {
    const raw = m[1]; // 20240315T140000
    const year = raw.slice(0, 4), month = raw.slice(4, 6), day = raw.slice(6, 8);
    const hour = raw.slice(9, 11), min = raw.slice(11, 13);
    return `${year}-${month}-${day} ${hour}:${min}`;
  }
  return null;
}

function normalizeCompany(name) {
  return name
    .toLowerCase()
    .replace(/\b(inc\.?|llc\.?|corp\.?|ltd\.?|co\.?|company|technologies|technology|tech|labs|lab|solutions|group|holdings|international|global|services|software|systems|networks|digital)\b/gi, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

// Personal/public email providers — not company domains
const PUBLIC_EMAIL_DOMAINS = new Set([
  'gmail.com','yahoo.com','hotmail.com','outlook.com','aol.com','icloud.com',
  'protonmail.com','mail.com','zoho.com','yandex.com','live.com','msn.com',
]);
const JOB_BOARD_DOMAINS = ['linkedin.com','indeed.com','glassdoor.com','ziprecruiter.com','dice.com','monster.com'];

// ─── Company extraction ───────────────────────────────────────────────────────

function extractCompanyFromATS(from, subject, body) {
  const domain = getSenderDomain(from);
  const displayName = getSenderDisplayName(from);
  const isATS = Object.keys(ATS_DOMAINS).some(d => domain.includes(d));

  // ATS subdomain: e.g. acme.greenhouse.io → "Acme"
  if (domain.includes('.greenhouse.io')) {
    const sub = domain.replace(/\.?greenhouse\.io$/, '').split('.').pop();
    if (sub && sub.length > 2 && !['no-reply','noreply','jobs','careers'].includes(sub)) return capitalize(sub);
  }
  if (domain.includes('.lever.co') && !domain.endsWith('hire.lever.co')) {
    const sub = domain.replace(/\.?lever\.co$/, '').split('.').pop();
    if (sub && sub.length > 2) return capitalize(sub);
  }

  // Display name from From header — only trust for ATS senders (prevents "HR" being the company)
  if (displayName && isATS) {
    const cleaned = displayName
      .replace(/\b(recruiting|talent acquisition|talent|hr team|hr|careers|team|hiring|jobs?|no.?reply|noreply|notifications?|updates?|do.not.reply)\b/gi, '')
      .replace(/\s+/g, ' ').trim();
    if (cleaned.length > 2 && cleaned.length < 50 && /[A-Z]/.test(cleaned[0])) return cleaned;
  }

  // Subject patterns first — more concise, less noise
  const subjectPatterns = [
    // "sent to / application to / applied to [Company]"
    /(?:application (?:to|at|for)|applied to|sent to)\s+([A-Z][a-zA-Z0-9\s&,.']{1,50}?)(?:\s*[-–—]|\s+for\b|[,!.]|$)/,
    // "Something - Company" → company after last dash
    /[-–—]\s*([A-Z][a-zA-Z0-9\s&,.']{2,40})$/,
    // "Role | Company"
    /\|\s*([A-Z][a-zA-Z0-9\s&,.']{2,40})$/,
  ];
  for (const p of subjectPatterns) {
    const m = subject.match(p);
    if (m) {
      const candidate = m[1].trim();
      if (candidate.length > 1 && !isGenericWord(candidate) && !isActionPhrase(candidate)) return candidate;
    }
  }

  // Body patterns — require leading uppercase (no /i flag on capture group)
  const bodyPatterns = [
    // "thank you for applying to Stripe" — stop at "for" to avoid "applied to SWE at Acme"
    /(?:applying to|thank you for applying to|application to)\s+([A-Z][a-zA-Z0-9\s&,.']{1,40}?)(?:\s+for\b|\s+is\b|\s+has\b|[,!.]|$)/,
    /(?:team at|from the team at|from the folks at|the team at)\s+([A-Z][a-zA-Z0-9\s&,.']{1,50})(?:[,!.]|$)/,
    /^([A-Z][a-zA-Z\s&]{2,40})\s+(?:Recruiting|Talent Acquisition|Talent Team|HR Team|Careers|Hiring Team)/m,
  ];
  for (const pattern of bodyPatterns) {
    const m = body.match(pattern);
    if (m) {
      const candidate = m[1].trim().replace(/\s+/g, ' ');
      if (candidate.length > 1 && !isGenericWord(candidate) && !isActionPhrase(candidate)) return candidate;
    }
  }

  // Direct corporate email: not ATS, not public provider, not job board → domain root IS the company
  if (!isATS && !PUBLIC_EMAIL_DOMAINS.has(domain) && !JOB_BOARD_DOMAINS.some(jb => domain.endsWith(jb))) {
    const domainRoot = domain.split('.')[0];
    if (domainRoot && domainRoot.length > 2 && !['hr','jobs','careers','recruiting','talent','info','mail','no-reply','noreply'].includes(domainRoot)) {
      return capitalize(domainRoot);
    }
    // Try second-level domain part: careers.stripe.com → "stripe"
    const parts = domain.split('.');
    if (parts.length >= 2) return capitalize(parts[parts.length - 2]);
  }

  return null;
}

function isActionPhrase(s) {
  const actionWords = ['phone','screen','interview','technical','update','invitation','schedule','next','steps','congratulations','unfortunately'];
  return actionWords.some(w => s.toLowerCase().startsWith(w));
}

function isGenericWord(s) {
  const generic = ['your','the','we','our','thank','please','hello','hi','dear','application','position','role',
    'this','that','it','at','in','on','for','of','update','via','through','with','from','about'];
  return generic.includes(s.toLowerCase().split(' ')[0]);
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function extractJobTitle(subject, body) {
  // All patterns require capture group to start with actual uppercase letter (no /i on class)
  const patterns = [
    // "for the Software Engineer role" or "for a Senior Dev position"
    /(?:for the|for a|applied for the|role of|position of)\s+([A-Z][a-zA-Z\s\/\-]{2,60}?)(?:\s+(?:at|position|role)\b|\s*[,!.]|$)/,
    // "position: Software Engineer" or "role: Senior Dev" with colon
    /(?:position|role|job title|opening):\s*([A-Z][a-zA-Z\s\/\-]{2,60})(?:[,!.\n]|$)/,
    // "applied for / to the Software Engineer"
    /(?:applied for the|applied to the)\s+([A-Z][a-zA-Z\s\/\-]{2,60}?)(?:\s+(?:at|position|role)\b|\s*[,!.]|$)/,
    // Subject: "Application for Software Engineer - Acme" → capture before dash
    /^(?:application\s+(?:for|to))\s+([A-Z][a-zA-Z\s\/\-]{2,60}?)(?:\s*[-–@]|\s+at\b)/,
    // "your application for the Software Engineer"
    /your application for (?:the\s+)?([A-Z][a-zA-Z\s\/\-]{2,60}?)(?:\s+(?:at|position|role)\b|\s*[,!.]|$)/,
  ];
  const text = subject + '\n' + body;
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      const t = m[1].trim().replace(/\s+/g, ' ');
      if (t.length > 2 && t.length < 80 && !isGenericWord(t) && !isActionPhrase(t)) return t;
    }
  }
  return null;
}

function extractInterviewLink(body) {
  const patterns = [
    /https?:\/\/calendly\.com\/[^\s"'<>\]]+/i,
    /https?:\/\/cal\.com\/[^\s"'<>\]]+/i,
    /https?:\/\/schedule\.google\.com\/[^\s"'<>\]]+/i,
    /https?:\/\/[^\s"'<>\]]*\/schedule[^\s"'<>\]]*/i,
    /https?:\/\/[^\s"'<>\]]*interview[^\s"'<>\]]*/i,
    /https?:\/\/[^\s"'<>\]]*\.zoom\.us\/[^\s"'<>\]]*/i,
    /https?:\/\/teams\.microsoft\.com\/[^\s"'<>\]]*/i,
  ];
  for (const p of patterns) {
    const m = body.match(p);
    if (m) return m[0];
  }
  return null;
}

// ─── Classification ───────────────────────────────────────────────────────────

function classify(subject, body) {
  const text = `${subject}\n${body}`.toLowerCase();
  const scores = {};

  for (const rule of STAGE_RULES) {
    let count = 0;
    for (const phrase of rule.phrases) {
      if (text.includes(phrase.toLowerCase())) count++;
    }
    if (count > 0) scores[rule.status] = count;
  }

  const entries = Object.entries(scores);
  if (entries.length === 0) return { status: null, confidence: 'Low', matchedPhrases: 0 };

  // Sort by rank (highest rank wins if tie in phrase count)
  entries.sort(([aStatus, aCount], [bStatus, bCount]) => {
    if (bCount !== aCount) return bCount - aCount; // more matches wins
    return STATUS_RANK[bStatus] - STATUS_RANK[aStatus]; // higher rank wins
  });

  const [winnerStatus, winnerCount] = entries[0];
  const totalMatches = entries.reduce((sum, [, c]) => sum + c, 0);
  const secondCount = entries[1]?.[1] || 0;

  let confidence;
  if (winnerCount >= 3 || (winnerCount >= 2 && secondCount === 0)) {
    confidence = 'High';
  } else if (winnerCount >= 2 || (winnerCount === 1 && secondCount === 0)) {
    confidence = 'Medium';
  } else {
    confidence = 'Low'; // 1 match and ambiguous, or tied
  }

  return { status: winnerStatus, confidence, matchedPhrases: totalMatches, scores };
}

// ─── Noise / ignore detection ─────────────────────────────────────────────────

// Subject patterns that clearly indicate a real job event (not noise)
const APPLICATION_SUBJECTS = [
  'application', 'applied', 'interview', 'offer', 'assessment', 'next steps',
  'phone screen', 'technical', 'your application was sent', 'sent to',
];

function isNoise(subject, from) {
  const subjectLower = subject.toLowerCase();
  const emailAddr = getSenderEmail(from);

  // If subject clearly looks like a real job event, never treat as noise
  if (APPLICATION_SUBJECTS.some(s => subjectLower.includes(s))) return false;

  if (NOISE_SENDERS.some(s => emailAddr.includes(s))) return true;
  if (NOISE_SUBJECTS.some(s => subjectLower.includes(s))) return true;

  if (subjectLower.startsWith('accepted:') && !subjectLower.includes('interview')) return true;

  return false;
}

function isFromJobBoard(domain) {
  // These domains send automated digests — only valid if subject clearly about an application
  const jobBoards = ['linkedin.com', 'indeed.com', 'glassdoor.com', 'ziprecruiter.com'];
  return jobBoards.some(jb => domain.endsWith(jb));
}

// ─── Main export ──────────────────────────────────────────────────────────────

function parseEmail(message) {
  const headers = message.payload?.headers || [];
  const getHeader = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';

  const subject = getHeader('subject');
  const from = getHeader('from');
  const dateStr = getHeader('date');
  const body = extractBody(message.payload);
  const domain = getSenderDomain(from);
  const atsPlatform = Object.entries(ATS_DOMAINS).find(([d]) => domain.includes(d))?.[1] || null;

  // Hard ignore: noise emails
  if (isNoise(subject, from)) {
    return { ignored: true, reason: 'Automated digest/promotional email' };
  }

  // Calendar invite → treat as interview confirmation
  const hasCalendar = hasCalendarAttachment(message.payload);
  if (hasCalendar) {
    const calDate = extractCalendarDateTime(body);
    const company = extractCompanyFromATS(from, subject, body) || 'Unknown Company';
    return {
      company,
      job_title: extractJobTitle(subject, body) || 'Interview',
      status: 'Phone Screen',
      confidence: 'High',
      matchedPhrases: 1,
      needs_review: 0,
      interview_link: extractInterviewLink(body) || '',
      notes: `Calendar invite received${calDate ? ` — ${calDate}` : ''}`,
      isCalendarInvite: true,
      source: atsPlatform ? `gmail:${atsPlatform}` : 'gmail',
    };
  }

  // Run classification
  const { status, confidence, matchedPhrases, scores } = classify(subject, body);

  // If from a known ATS but no phrases matched → could be a legit application email
  const isKnownATS = !!atsPlatform;
  const hasApplicationKeywords = matchedPhrases > 0;

  if (!hasApplicationKeywords && !isKnownATS) {
    return null; // Not a job email at all
  }

  // If from a job board domain with no phrases, skip (it's a digest)
  if (!hasApplicationKeywords && isFromJobBoard(domain) && !isKnownATS) {
    return { ignored: true, reason: 'Job board email with no application keywords' };
  }

  const company = extractCompanyFromATS(from, subject, body);
  const resolvedCompany = company || (atsPlatform ? `Via ${atsPlatform}` : domain.split('.')[0] || 'Unknown');
  const resolvedTitle = extractJobTitle(subject, body) || 'Unknown Position';
  const resolvedStatus = status || 'Applied';
  const resolvedConfidence = status ? confidence : 'Low';
  const needsReview = resolvedConfidence === 'Low' || !status || !company;

  let applicationDate;
  try { applicationDate = new Date(dateStr).toISOString().split('T')[0]; }
  catch { applicationDate = new Date().toISOString().split('T')[0]; }

  return {
    company: resolvedCompany,
    job_title: resolvedTitle,
    application_date: applicationDate,
    status: resolvedStatus,
    confidence: resolvedConfidence,
    needs_review: needsReview ? 1 : 0,
    source: atsPlatform ? `gmail:${atsPlatform}` : 'gmail',
    gmail_message_id: message.id,
    interview_link: extractInterviewLink(body) || '',
    last_email_date: applicationDate,
    notes: `Imported from Gmail. Subject: "${subject}"${scores ? ` Matched: ${JSON.stringify(scores)}` : ''}`,
  };
}

module.exports = { parseEmail, normalizeCompany, STATUS_RANK };
