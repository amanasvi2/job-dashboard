# 💼 Job Application Dashboard

A full-stack, locally-hosted job application tracker with Gmail integration, Kanban board, and analytics.

## Features

- **Gmail Sync** — OAuth2-powered email scanner that auto-imports applications from LinkedIn, Greenhouse, Lever, Workday, Indeed, Glassdoor, Handshake, and more
- **Dashboard** — summary stats, monthly chart, status pie chart, upcoming follow-ups
- **Applications Table** — searchable, sortable list with inline delete and CSV import
- **Kanban Board** — drag-and-drop cards across status columns
- **Dark mode** by default, fully mobile responsive

---

## Quick Start

### 1. Install dependencies

```bash
cd job-dashboard
npm run install:all
```

### 2. Set up environment variables

```bash
cp .env.example .env
```

Edit `.env` — see the section below for Google OAuth credentials.

### 3. Run the app

```bash
npm run dev
```

- Frontend: http://localhost:5173  
- Backend API: http://localhost:3001

---

## Google OAuth Setup (for Gmail Sync)

> You can use the app fully without Gmail. This step is only needed for the email import feature.

### Step 1 — Create a Google Cloud project

1. Go to [console.cloud.google.com](https://console.cloud.google.com/)
2. Click **Select a project** → **New Project**
3. Name it anything (e.g. `Job Dashboard`) and click **Create**

### Step 2 — Enable the Gmail API

1. In the left sidebar, go to **APIs & Services → Library**
2. Search for **Gmail API** and click **Enable**

### Step 3 — Configure the OAuth consent screen

1. Go to **APIs & Services → OAuth consent screen**
2. Select **External**, click **Create**
3. Fill in:
   - App name: `Job Dashboard`
   - User support email: your email
   - Developer contact email: your email
4. Click **Save and Continue** through the next steps (no scopes needed here)
5. On the **Test users** step, click **+ Add Users** and add your Gmail address
6. Click **Save and Continue**

### Step 4 — Create OAuth credentials

1. Go to **APIs & Services → Credentials**
2. Click **+ Create Credentials → OAuth client ID**
3. Application type: **Web application**
4. Name: `Job Dashboard Local`
5. Under **Authorized redirect URIs**, add:
   ```
   http://localhost:3001/api/gmail/callback
   ```
6. Click **Create**
7. Copy the **Client ID** and **Client Secret**

### Step 5 — Add to .env

```env
GOOGLE_CLIENT_ID=123456789-abc.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-yourSecretHere
GOOGLE_REDIRECT_URI=http://localhost:3001/api/gmail/callback
```

Restart the server after editing `.env`.

---

## CSV Import Format

Import jobs in bulk via **Applications → Import CSV**. Required columns:

| Column | Required | Example |
|--------|----------|---------|
| company | ✅ | Acme Corp |
| job_title | ✅ | Software Engineer |
| application_date | | 2024-03-15 |
| status | | Applied |
| notes | | Applied via referral |
| job_posting_url | | https://... |
| salary_range | | $120k–$150k |
| contact_name | | Jane Smith |
| contact_email | | jane@acme.com |
| next_follow_up | | 2024-03-22 |

Status values: `Applied`, `Phone Screen`, `Technical Interview`, `Final Round`, `Offer`, `Rejected`

---

## Data Storage

All data is stored locally in `data/jobs.db` (SQLite). Nothing is sent to any external service.

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18 + Vite + Tailwind CSS |
| Backend | Node.js + Express |
| Database | SQLite (better-sqlite3) |
| Charts | Recharts |
| Drag & Drop | @dnd-kit |
| Gmail | googleapis + OAuth2 |
