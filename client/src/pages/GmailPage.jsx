import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { gmailApi } from '../api/client.js';

const STATUS_ICON = {
  imported: '✅',
  skipped: '⏭',
  duplicate: '♻',
  error: '❌',
};

function SyncResult({ detail }) {
  return (
    <div className="flex items-start gap-2 text-sm py-1.5 border-b border-gray-800 last:border-0">
      <span>{STATUS_ICON[detail.status] || '•'}</span>
      <span className="text-gray-300">
        {detail.company ? <><strong>{detail.company}</strong> — {detail.role}</> : detail.reason || detail.id}
      </span>
      <span className={`ml-auto text-xs shrink-0 ${detail.status === 'imported' ? 'text-green-400' : detail.status === 'error' ? 'text-red-400' : 'text-gray-500'}`}>
        {detail.status}
      </span>
    </div>
  );
}

export default function GmailPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [connected, setConnected] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [showDetails, setShowDetails] = useState(false);
  const [missingCreds, setMissingCreds] = useState(false);

  useEffect(() => {
    const connectedParam = searchParams.get('connected');
    const errorParam = searchParams.get('error');

    if (connectedParam === 'true') {
      toast.success('Gmail connected!');
      setSearchParams({});
    } else if (errorParam) {
      toast.error(`Auth error: ${decodeURIComponent(errorParam)}`);
      setSearchParams({});
    }
  }, []);

  useEffect(() => {
    gmailApi.status()
      .then(({ connected }) => setConnected(connected))
      .finally(() => setLoadingStatus(false));
    gmailApi.history().then(setHistory).catch(() => {});
  }, []);

  async function handleConnect() {
    try {
      const { url } = await gmailApi.authUrl();
      window.location.href = url;
    } catch (err) {
      if (err.response?.status === 503) {
        setMissingCreds(true);
        toast.error('Google OAuth credentials not set up yet');
      } else {
        toast.error('Failed to get auth URL');
      }
    }
  }

  async function handleDisconnect() {
    if (!confirm('Disconnect Gmail? Your imported jobs will remain.')) return;
    await gmailApi.disconnect();
    setConnected(false);
    toast.success('Gmail disconnected');
  }

  async function handleSync() {
    setSyncing(true);
    setLastResult(null);
    setShowDetails(false);
    const toastId = toast.loading('Scanning Gmail (this may take a minute)…');
    try {
      const result = await gmailApi.sync();
      setLastResult(result);
      toast.success(`Imported ${result.imported} jobs from ${result.scanned} emails`, { id: toastId });
      gmailApi.history().then(setHistory).catch(() => {});
    } catch (err) {
      toast.error(err.response?.data?.error || 'Sync failed', { id: toastId });
    } finally {
      setSyncing(false);
    }
  }

  if (loadingStatus) return <div className="text-gray-500 py-12 text-center">Loading…</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Gmail Sync</h2>
        <p className="text-gray-500 text-sm mt-1">Auto-import job applications from your inbox</p>
      </div>

      {/* Connection card */}
      <div className="card space-y-4">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500' : 'bg-gray-600'}`} />
          <span className="font-semibold text-white">{connected ? 'Gmail Connected' : 'Gmail Not Connected'}</span>
        </div>

        {!connected ? (
          <div className="space-y-3">
            <p className="text-gray-400 text-sm">
              Connect your Gmail account to automatically scan for job application confirmation emails from LinkedIn, Greenhouse, Lever, Workday, Indeed, Glassdoor, Handshake, and more.
            </p>
            <button className="btn-primary" onClick={handleConnect}>
              Connect Gmail →
            </button>

            {missingCreds && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 text-sm space-y-2">
                <p className="text-yellow-300 font-semibold">⚠ Google OAuth credentials required</p>
                <p className="text-gray-400">Add <code className="text-gray-300">GOOGLE_CLIENT_ID</code> and <code className="text-gray-300">GOOGLE_CLIENT_SECRET</code> to your <code className="text-gray-300">.env</code> file.</p>
                <p className="text-gray-400">See the README for step-by-step setup instructions.</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-gray-400 text-sm">
              Scans the last 90 days of emails for job application confirmations.
            </p>
            <div className="flex gap-3">
              <button className="btn-primary" onClick={handleSync} disabled={syncing}>
                {syncing ? '⏳ Syncing…' : '🔄 Sync Gmail'}
              </button>
              <button className="btn-secondary text-sm" onClick={handleDisconnect}>
                Disconnect
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Last sync result */}
      {lastResult && (
        <div className="card space-y-3">
          <h3 className="font-semibold text-white">Last Sync Results</h3>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-gray-800 rounded-lg p-3">
              <div className="text-2xl font-bold text-white">{lastResult.scanned}</div>
              <div className="text-xs text-gray-500">Scanned</div>
            </div>
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
              <div className="text-2xl font-bold text-green-400">{lastResult.imported}</div>
              <div className="text-xs text-gray-500">Imported</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-3">
              <div className="text-2xl font-bold text-gray-400">{lastResult.skipped}</div>
              <div className="text-xs text-gray-500">Skipped</div>
            </div>
          </div>
          {lastResult.details?.length > 0 && (
            <div>
              <button
                className="text-xs text-brand-400 hover:underline"
                onClick={() => setShowDetails(v => !v)}
              >
                {showDetails ? 'Hide' : 'Show'} details ({lastResult.details.length})
              </button>
              {showDetails && (
                <div className="mt-3 bg-gray-800 rounded-lg p-3 max-h-64 overflow-y-auto space-y-0">
                  {lastResult.details.map((d, i) => <SyncResult key={i} detail={d} />)}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Sync history */}
      {history.length > 0 && (
        <div className="card space-y-3">
          <h3 className="font-semibold text-white">Sync History</h3>
          <div className="space-y-2">
            {history.map(log => (
              <div key={log.id} className="flex items-center justify-between text-sm py-2 border-b border-gray-800 last:border-0">
                <span className="text-gray-400">{new Date(log.sync_date).toLocaleString()}</span>
                <span className="text-gray-300">
                  <span className="text-green-400 font-medium">{log.jobs_imported} imported</span>
                  {' · '}{log.emails_scanned} scanned
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* How it works */}
      <div className="card space-y-3">
        <h3 className="font-semibold text-white">How It Works</h3>
        <ul className="space-y-2 text-sm text-gray-400">
          <li>• Scans your last <strong className="text-gray-300">90 days</strong> of Gmail</li>
          <li>• Recognizes emails from <strong className="text-gray-300">LinkedIn, Greenhouse, Lever, Workday, Indeed, Glassdoor, Handshake</strong>, and generic application confirmations</li>
          <li>• Extracts company name, job title, date, and any interview scheduling links</li>
          <li>• Already-imported emails are automatically skipped (no duplicates)</li>
          <li>• Access is <strong className="text-gray-300">read-only</strong> — no emails are modified or deleted</li>
        </ul>
      </div>
    </div>
  );
}
