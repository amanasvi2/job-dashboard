// Known job platform senders and their company extraction strategies
const KNOWN_SENDERS = {
  'linkedin.com': { platform: 'LinkedIn' },
  'greenhouse.io': { platform: 'Greenhouse' },
  'lever.co': { platform: 'Lever' },
  'workday.com': { platform: 'Workday' },
  'myworkdayjobs.com': { platform: 'Workday' },
  'indeed.com': { platform: 'Indeed' },
  'glassdoor.com': { platform: 'Glassdoor' },
  'joinhandshake.com': { platform: 'Handshake' },
  'smartrecruiters.com': { platform: 'SmartRecruiters' },
  'icims.com': { platform: 'iCIMS' },
  'taleo.net': { platform: 'Taleo' },
  'successfactors.com': { platform: 'SAP SuccessFactors' },
  'bamboohr.com': { platform: 'BambooHR' },
  'jobvite.com': { platform: 'Jobvite' },
  'ashbyhq.com': { platform: 'Ashby' },
  'rippling.com': { platform: 'Rippling' },
};

const APPLICATION_KEYWORDS = [
  'thank you for applying',
  'thanks for applying',
  'application received',
  'application confirmation',
  'application submitted',
  'we received your application',
  'your application has been received',
  'your application has been submitted',
  'applied to',
  'application for',
  'you applied',
  'application acknowledgment',
  'confirming your application',
];

const REJECTION_KEYWORDS = [
  'we regret', 'not moving forward', 'decided to move forward with other',
  'we will not', 'not a match', 'decided not to', 'we have decided',
  'position has been filled', 'no longer considering',
];

const INTERVIEW_KEYWORDS = [
  'schedule an interview', 'interview invitation', 'phone screen',
  'technical interview', 'we would like to speak', 'next steps',
  'calendly.com', 'cal.com', 'schedule.google.com',
];

function getSenderDomain(from) {
  const match = from.match(/@([a-zA-Z0-9.-]+)/);
  return match ? match[1].toLowerCase() : '';
}

function matchesKnownSender(domain) {
  for (const [key, val] of Object.entries(KNOWN_SENDERS)) {
    if (domain.includes(key)) return val.platform;
  }
  return null;
}

function isJobApplicationEmail(subject, body, from) {
  const text = `${subject} ${body}`.toLowerCase();
  const domain = getSenderDomain(from);

  if (matchesKnownSender(domain)) {
    return APPLICATION_KEYWORDS.some(kw => text.includes(kw)) ||
           subject.toLowerCase().includes('application');
  }

  return APPLICATION_KEYWORDS.some(kw => text.includes(kw));
}

function extractCompany(subject, body, from, platform) {
  // LinkedIn: "Your application was sent to [Company]"
  let m = subject.match(/(?:application.*?to|applied to|at)\s+([A-Z][^,.\n!?]+?)(?:\s+for|\s+is|\s*[,.]|$)/i);
  if (m) return m[1].trim();

  // Greenhouse/Lever: usually in body "Thank you for applying to [Company]"
  m = body.match(/(?:applying to|application to|applied to)\s+([A-Z][^,.\n!?]+?)(?:\s+for|\s+is|\s*[,!.]|$)/i);
  if (m) return m[1].trim();

  // "from the team at [Company]"
  m = body.match(/team at\s+([A-Z][^,.\n!?]+?)(?:\s*[,!.]|$)/i);
  if (m) return m[1].trim();

  // Extract from email sender name: "Acme Corp <no-reply@acme.com>"
  const nameMatch = from.match(/^([^<@]+?)\s*</);
  if (nameMatch) {
    const name = nameMatch[1].trim();
    if (name && !name.toLowerCase().includes('no-reply') && !name.toLowerCase().includes('noreply')) {
      return name;
    }
  }

  // Fall back to domain root
  const domain = getSenderDomain(from);
  const domainRoot = domain.split('.')[0];
  if (domainRoot && !['greenhouse', 'lever', 'linkedin', 'indeed', 'glassdoor', 'handshake', 'workday'].includes(domainRoot)) {
    return domainRoot.charAt(0).toUpperCase() + domainRoot.slice(1);
  }

  return platform || 'Unknown Company';
}

function extractJobTitle(subject, body) {
  // "application for [Job Title]" or "applied for [Job Title]"
  let m = subject.match(/(?:for the|for a|for)\s+(?:role of\s+|position of\s+)?([A-Z][^,.\n!?]+?)(?:\s+at|\s+position|\s+role|\s*[,.]|$)/i);
  if (m) return m[1].trim();

  m = body.match(/(?:for the|for a|applied for)\s+(?:role of\s+|position of\s+)?([A-Z][^,.\n!?]+?)(?:\s+at|\s+position|\s+role|\s*[,!.]|$)/i);
  if (m) return m[1].trim();

  // "position: Software Engineer" or "role: "
  m = body.match(/(?:position|role|job title):\s*([^\n,]+)/i);
  if (m) return m[1].trim();

  return null;
}

function extractInterviewLink(body) {
  const linkPatterns = [
    /https?:\/\/calendly\.com\/[^\s"'<>]+/i,
    /https?:\/\/cal\.com\/[^\s"'<>]+/i,
    /https?:\/\/schedule\.google\.com\/[^\s"'<>]+/i,
    /https?:\/\/[^\s"'<>]*\/schedule[^\s"'<>]*/i,
    /https?:\/\/[^\s"'<>]*interview[^\s"'<>]*/i,
  ];
  for (const pattern of linkPatterns) {
    const m = body.match(pattern);
    if (m) return m[0];
  }
  return null;
}

function determineStatus(subject, body) {
  const text = `${subject} ${body}`.toLowerCase();
  if (REJECTION_KEYWORDS.some(kw => text.includes(kw))) return 'Rejected';
  if (INTERVIEW_KEYWORDS.some(kw => text.includes(kw))) return 'Phone Screen';
  return 'Applied';
}

function decodeBase64Url(str) {
  return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
}

function extractBody(payload) {
  if (!payload) return '';

  if (payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }

  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return decodeBase64Url(part.body.data);
      }
    }
    for (const part of payload.parts) {
      if (part.mimeType === 'text/html' && part.body?.data) {
        const html = decodeBase64Url(part.body.data);
        return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
      }
      if (part.parts) {
        const nested = extractBody(part);
        if (nested) return nested;
      }
    }
  }

  return '';
}

function parseEmail(message) {
  const headers = message.payload?.headers || [];
  const getHeader = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';

  const subject = getHeader('subject');
  const from = getHeader('from');
  const dateStr = getHeader('date');
  const body = extractBody(message.payload);

  if (!isJobApplicationEmail(subject, body, from)) {
    return null;
  }

  const domain = getSenderDomain(from);
  const platform = matchesKnownSender(domain);
  const company = extractCompany(subject, body, from, platform);
  const jobTitle = extractJobTitle(subject, body) || 'Unknown Position';
  const status = determineStatus(subject, body);
  const interviewLink = extractInterviewLink(body);

  let applicationDate;
  try {
    applicationDate = new Date(dateStr).toISOString().split('T')[0];
  } catch {
    applicationDate = new Date().toISOString().split('T')[0];
  }

  return {
    company,
    job_title: jobTitle,
    application_date: applicationDate,
    status,
    source: platform ? `gmail:${platform}` : 'gmail',
    gmail_message_id: message.id,
    interview_link: interviewLink || '',
    notes: `Imported from Gmail. Subject: "${subject}"`,
  };
}

module.exports = { parseEmail, isJobApplicationEmail };
