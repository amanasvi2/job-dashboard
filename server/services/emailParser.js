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
      'you applied', 'applied to', 'your application was sent',
      'application confirmation', 'your application has been received',
      'your application has been submitted', 'successfully applied',
      'confirming your application', 'application acknowledgment',
      'submission received', 'submission for',
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
    let cleaned = displayName
      .replace(/\b(recruiting|talent acquisition|talent|hr team|hr|careers|team|hiring|jobs?|no.?reply|noreply|notifications?|updates?|do.not.reply)\b/gi, '')
      .replace(/\s+/g, ' ').trim();

    // "Name from Company" (e.g. "Lisa Hurst from Visa") → extract just "Company"
    const fromMatch = cleaned.match(/\bfrom\s+([A-Z][a-zA-Z0-9\s&,.']{2,40})\s*$/);
    if (fromMatch) {
      const co = fromMatch[1].trim();
      if (co.length > 2 && !isGenericWord(co) && !isActionPhrase(co)) return co;
    }

    if (cleaned.length > 2 && cleaned.length < 50 && /[A-Z]/.test(cleaned[0])) return cleaned;
  }

  // Try to extract company AND title together from the subject line
  const both = parseSubjectForBoth(subject);
  if (both.company) return both.company;

  // Body patterns — require leading uppercase (no /i flag on capture group)
  const bodyPatterns = [
    /(?:applying to|thank you for applying to|application to)\s+([A-Z][a-zA-Z0-9\s&,.'`-]{1,50}?)(?:\s+for\b|\s+is\b|\s+has\b|[,!.]|$)/,
    /(?:team at|from the team at|from the folks at|the team at)\s+([A-Z][a-zA-Z0-9\s&,.'`-]{1,50})(?:[,!.]|$)/,
    /^([A-Z][a-zA-Z\s&]{2,40})\s+(?:Recruiting|Talent Acquisition|Talent Team|HR Team|Careers|Hiring Team)/m,
    /\bat\s+([A-Z][a-zA-Z0-9\s&,.'`-]{1,40}?)\s*[.!](?:\s|$)/,
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
  const actionWords = [
    'phone','screen','interview','technical','update','invitation','schedule','next','steps',
    'congratulations','unfortunately','thanks','thank','looking','let\'s','lets','please',
    'hello','hi','dear','greetings','reminder','notice','regarding','fyi','action','important',
    'response','confirmation','replied','forwarded','decision','outcome','status',
  ];
  return actionWords.some(w => s.toLowerCase().startsWith(w));
}

function isGenericWord(s) {
  const generic = [
    'your','the','we','our','thank','thanks','please','hello','hi','dear','application',
    'position','role','this','that','it','at','in','on','for','of','update','via',
    'through','with','from','about','regarding','reminder','notice','alert','sorry',
    'congratulations','greetings','fyi','action','important','re','fw','fwd',
    'a','an','is','has','was','be','message','letter','notification','info','information',
    'response','confirmation','decision','outcome','status',
  ];
  return generic.includes(s.toLowerCase().split(' ')[0]);
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Parse subject line and try to return BOTH company and title at once.
// This is more accurate than parsing them separately.
function parseSubjectForBoth(subject) {
  const s = subject.trim();
  let m;

  // Helper: match and validate uppercase start (works with /i flag on trigger, strict on capture)
  const upperStart = (str) => str && /^[A-Z]/.test(str);

  // "Application for Title at Company" / "Your application for Title at Company"
  // (no ^ anchor — handles "Your application for...", "Re: application for...")
  m = s.match(/\bapplication\s+(?:received\s+)?(?:for|–|-)\s+(.+?)\s+(?:at|@)\s+(.+?)(?:\s*[-–|,]|$)/i);
  if (m) return clean2(m[1], m[2]);

  // "Application for Title - Company" (dash-separated, no "at") — "for" required to avoid false positives
  m = s.match(/\bapplication(?:\s+received)?\s+for\s+(.+?)\s*[-–]\s*(.+?)(?:\s*[-–]|$)/i);
  if (m) return clean2(m[1], m[2]);

  // "Company received your application for Title"
  m = s.match(/^(.+?)\s+received\s+your\s+application\s+for\s+(.+)/i);
  if (m) return clean2(m[2], m[1]);

  // "Company Application -- Title" or "Company Application: Title" (e.g. "Stripe Application: SWE")
  m = s.match(/^([A-Z][a-zA-Z0-9\s&,.']{1,35}?)\s+application\s*[-–:\s]+(.+?)(?:\s*[-–,]|$)/i);
  if (m && !isGenericWord(m[1]) && !isActionPhrase(m[1])) {
    const r = clean2(m[2], m[1]);
    if (r.title) return r;
  }

  // "applying to/at Company" or "applied to/at Company" (e.g. "Thank you for applying to Google")
  m = s.match(/\bappl(?:ying|ied|y)\s+(?:to|at)\s+([a-zA-Z][a-zA-Z0-9\s&,.'-]{1,50}?)(?:[!.,]|\s+for\b|$)/i);
  if (m && upperStart(m[1])) return { title: null, company: cleanStr(m[1]) };

  // "application to Company" (e.g. "Regarding your application to XPENG")
  m = s.match(/\bapplication\s+to\s+([a-zA-Z][a-zA-Z0-9\s&,.'-]{1,50}?)(?:[!.,]|\s+for\b|$)/i);
  if (m && upperStart(m[1])) return { title: null, company: cleanStr(m[1]) };

  // "interest in Company" (e.g. "Thank you for your interest in Stripe" or "Angle Health, Archita")
  m = s.match(/\binterest\s+in\s+([a-zA-Z][a-zA-Z0-9\s&,.'-]{1,50}?)(?:[,!.]|\s+for\b|$)/i);
  if (m && upperStart(m[1])) return { title: null, company: cleanStr(m[1]) };

  // "applying at/to Company for Title" (e.g. "Thank you for applying at AMD for Software Engineer")
  m = s.match(/\bappl(?:ying|ied)\s+(?:at|to)\s+(.+?)\s+for\s+(.+?)(?:[!.,]|$)/i);
  if (m && upperStart(m[1])) return clean2(m[2], m[1]);

  // "Title at Company" (e.g. "Software Engineer at Google - Application Confirmation")
  m = s.match(/^(.+?)\s+(?:at|@)\s+([A-Z][a-zA-Z0-9\s&,.']{1,40}?)(?:\s*[-–(|,]|$)/i);
  if (m && !isGenericWord(m[1]) && !isActionPhrase(m[1])) return clean2(m[1], m[2]);

  // "Company | Application | Title" (e.g. "Quora | Application | AI Engineer New Grad 2025-2026")
  m = s.match(/^([A-Z][a-zA-Z0-9\s&,.'-]{1,40}?)\s*\|\s*application\s*\|\s*(.+?)(?:\s*[|,]|$)/i);
  if (m && !isGenericWord(m[1]) && !isActionPhrase(m[1])) return clean2(m[2], m[1]);

  // "Title – Company" or "Title | Company" (em-dash / pipe separator)
  m = s.match(/^(.+?)\s*[–—|]\s*(.+?)(?:\s*[–—|,]|$)/);
  if (m && !isGenericWord(m[1]) && !isActionPhrase(m[1]) && !isGenericWord(m[2]) && !isActionPhrase(m[2])) {
    return clean2(m[1], m[2]);
  }

  // "Application received – Title – Company" (two separators)
  m = s.match(/(?:application\s+received?|received\s+application)\s*[-–—]\s*(.+?)\s*[-–—]\s*(.+?)$/i);
  if (m) return clean2(m[1], m[2]);

  // "Submission for: Title" (Workday style)
  m = s.match(/submission\s+for:\s*(.+)/i);
  if (m) return { title: cleanStr(m[1]), company: null };

  // "Application submitted to Company for Title" (Indeed)
  m = s.match(/(?:application\s+submitted\s+to|submitted\s+to)\s+(.+?)\s+for\s+(.+?)(?:\s*[-–,]|$)/i);
  if (m) return clean2(m[2], m[1]);

  // "Your application was sent to Company" (LinkedIn)
  m = s.match(/(?:application\s+was\s+sent\s+to|sent\s+to)\s+(.+?)(?:\s+for\b|\s*[-–,]|$)/i);
  if (m) return { title: null, company: cleanStr(m[1]) };

  // "Company: Title" or "Company - Title" with application/role/position suffix
  m = s.match(/^([A-Z][a-zA-Z0-9\s&,.']{1,35}?)(?::\s*|\s*-\s*)([A-Z][a-zA-Z0-9\s/\-&,.']{2,60}?)(?:\s+application|\s+role|\s+position|$)/i);
  if (m && !isActionPhrase(m[1]) && !isGenericWord(m[1]) && !isActionPhrase(m[2])) return clean2(m[2], m[1]);

  return { title: null, company: null };
}

function cleanStr(s) {
  if (!s) return null;
  let r = s.trim().replace(/\s+/g, ' ').replace(/[!.,;:]+$/, '');
  r = r.replace(/^(?:re:|fwd?:|applied:|application:|confirmed?:|reminder:|update:|notice:|action\s+required:|important:)\s*/i, '').trim();
  r = r.replace(/^\[[^\]]*\]\s*/i, '').trim(); // strip [bracketed] prefixes like [Application Update]
  if (r.length <= 1) return null;
  if (r.split(/\s+/).length > 8) return null; // too many words to be a job title
  return !isGenericWord(r) && !isActionPhrase(r) ? r : null;
}

function clean2(title, company) {
  return { title: cleanStr(title), company: cleanStr(company) };
}

function extractJobTitle(subject, body) {
  // Try subject first via shared parser
  const { title: subjectTitle } = parseSubjectForBoth(subject);
  if (subjectTitle) return subjectTitle;

  // Body patterns — all case-insensitive for the trigger phrase, but capture validated by post-check
  const patterns = [
    // "for the Software Engineer role/position"
    /(?:for the|for a|for our)\s+([a-zA-Z][a-zA-Z\s\/\-&]{2,60}?)\s+(?:role|position|opening|opportunity)\b/i,
    // "role: / position: / job title:" with colon
    /(?:position|role|job title|opening):\s*([a-zA-Z][a-zA-Z\s\/\-&]{2,60})(?:[,!.\n]|$)/i,
    // "applied for the Software Engineer"
    /(?:applied for the|applying for the)\s+([a-zA-Z][a-zA-Z\s\/\-&]{2,60}?)(?:\s+at\b|\s*[,!.]|$)/i,
    // "interest in the [Title] position"
    /interest in (?:the\s+)?([a-zA-Z][a-zA-Z\s\/\-&]{2,60}?)\s+(?:role|position|opportunity)\b/i,
    // "your application for [Title]"
    /your application for (?:the\s+)?([a-zA-Z][a-zA-Z\s\/\-&]{2,60}?)(?:\s+(?:at|position|role)\b|\s*[,!.]|$)/i,
    // "You applied to / You've applied to [Title] at" (LinkedIn/Handshake)
    /(?:you(?:'ve|\s+have)?\s+applied\s+to|applied\s+to\s+the)\s+([a-zA-Z][a-zA-Z\s\/\-&]{2,60}?)(?:\s+at\b|\s*[,!.]|$)/i,
    // "interview for the [Title]"
    /interview\s+for\s+(?:the\s+)?([a-zA-Z][a-zA-Z\s\/\-&]{2,60}?)(?:\s+(?:at|role|position)\b|\s*[,!.]|$)/i,
    // "we are excited to have you interview for [Title]"
    /(?:applied for|applying for)\s+(?:the\s+)?([a-zA-Z][a-zA-Z\s\/\-&]{2,60}?)(?:\s+(?:at|position|role)\b|\s*[,!.]|$)/i,
  ];

  const text = body;
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
    let applicationDate;
    try { applicationDate = new Date(dateStr).toISOString().split('T')[0]; }
    catch { applicationDate = new Date().toISOString().split('T')[0]; }
    return {
      company,
      job_title: extractJobTitle(subject, body) || 'Interview',
      application_date: applicationDate,
      status: 'Phone Screen',
      confidence: 'High',
      needs_review: 0,
      interview_link: extractInterviewLink(body) || '',
      last_email_date: applicationDate,
      gmail_message_id: message.id,
      notes: `Calendar invite received${calDate ? ` — ${calDate}` : ''}`,
      source: atsPlatform ? `gmail:${atsPlatform}` : 'gmail',
    };
  }

  // Run classification
  const { status, confidence, matchedPhrases, scores } = classify(subject, body);

  // If from a known ATS but no phrases matched → could be a legit application email
  const isKnownATS = !!atsPlatform;
  const hasApplicationKeywords = matchedPhrases > 0;

  // Is this from a direct corporate email (not ATS, not public provider, not job board)?
  const isDirectCorporate = !isKnownATS
    && !PUBLIC_EMAIL_DOMAINS.has(domain)
    && !JOB_BOARD_DOMAINS.some(jb => domain.endsWith(jb));

  if (!hasApplicationKeywords && !isKnownATS && !isDirectCorporate) {
    return null; // Not a job email at all
  }

  // If from a job board domain with no phrases, skip (it's a digest)
  if (!hasApplicationKeywords && isFromJobBoard(domain) && !isKnownATS) {
    return { ignored: true, reason: 'Job board email with no application keywords' };
  }

  // Try subject-line dual-extraction first (most reliable)
  const subjectBoth = parseSubjectForBoth(subject);

  const company = extractCompanyFromATS(from, subject, body) || subjectBoth.company;
  const resolvedCompany = company || (atsPlatform ? `Via ${atsPlatform}` : domain.split('.').slice(-2, -1)[0] || 'Unknown');
  const resolvedTitle = subjectBoth.title || extractJobTitle(subject, body) || null;
  const resolvedStatus = status || 'Applied';
  const resolvedConfidence = status ? confidence : 'Low';
  const needsReview = resolvedConfidence === 'Low' || !status || !company;

  let applicationDate;
  try { applicationDate = new Date(dateStr).toISOString().split('T')[0]; }
  catch { applicationDate = new Date().toISOString().split('T')[0]; }

  return {
    company: resolvedCompany,
    job_title: resolvedTitle || null,  // null = let UI show TBD rather than "Unknown Position"
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

module.exports = { parseEmail, normalizeCompany, STATUS_RANK, parseSubjectForBoth };
