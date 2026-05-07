const { google } = require('googleapis');
const db = require('../db/database');

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/gmail/callback'
  );
}

function getStoredTokens() {
  return db.prepare('SELECT * FROM gmail_tokens WHERE id = 1').get();
}

function saveTokens(tokens) {
  const existing = getStoredTokens();
  if (existing) {
    db.prepare(`
      UPDATE gmail_tokens SET access_token = ?, refresh_token = ?, expiry_date = ?, updated_at = datetime('now')
      WHERE id = 1
    `).run(tokens.access_token, tokens.refresh_token || existing.refresh_token, tokens.expiry_date || null);
  } else {
    db.prepare(`
      INSERT INTO gmail_tokens (id, access_token, refresh_token, expiry_date)
      VALUES (1, ?, ?, ?)
    `).run(tokens.access_token, tokens.refresh_token, tokens.expiry_date || null);
  }
}

async function getAuthedClient() {
  const tokens = getStoredTokens();
  if (!tokens?.access_token) return null;

  const client = getOAuth2Client();
  client.setCredentials({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expiry_date,
  });

  client.on('tokens', (newTokens) => {
    saveTokens(newTokens);
  });

  return client;
}

function getAuthUrl() {
  const client = getOAuth2Client();
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/gmail.readonly'],
  });
}

async function exchangeCode(code) {
  const client = getOAuth2Client();
  const { tokens } = await client.getToken(code);
  saveTokens(tokens);
  return tokens;
}

async function revokeAccess() {
  const client = await getAuthedClient();
  if (client) {
    try { await client.revokeCredentials(); } catch (_) {}
  }
  db.prepare('DELETE FROM gmail_tokens WHERE id = 1').run();
}

module.exports = { getAuthUrl, exchangeCode, getAuthedClient, getStoredTokens, revokeAccess };
