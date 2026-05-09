import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { gmailApi } from '../api/client.js';
import ConfidenceBadge from '../components/ConfidenceBadge.jsx';
import StatusBadge from '../components/StatusBadge.jsx';

const OUTCOME_ICON = {
  imported:      { icon: '✅', label: 'New entry', color: 'text-green-400' },
  updated:       { icon: '🔄', label: 'Updated',   color: 'text-blue-400'  },
  no_upgrade:    { icon: '⏭',  label: 'Skipped',   color: 'text-gray-500'  },
  duplicate_email: { icon: '♻', label: 'Duplicate', color: 'text-gray-600' },
  ignored:       { icon: '🚫', label: 'Ignored',   color: 'text-gray-600'  },
  error:         { icon: '❌', label: 'Error',     color: 'text-red-400'   },
};

function DetailRow({ d }) {
  const meta = OUTCOME_ICON[d.outcome] || { icon: '•', label: d.outcome, color: 'text-gray-400' };
  return (
    <div className={`flex items-start gap-2 py-2 border-b border-gray-800/60 last:border-0 ${d.needsReview ? 'bg-yellow-500/5' : ''}`}>
      <span className="text-base leading-none mt-0.5 shrink-0">{meta.icon}</span>
      <div className="flex-1 min-w-0">
        {d.company ? (
          <>
            <span className="text-sm text-gray-200 font-medium">{d.company}</span>
            {d.role && <span className="text-sm text-gray-500"> — {d.role}</span>}
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              {d.status && <StatusBadge status={d.newStatus || d.status} />}
              {d.confidence && <ConfidenceBadge confidence={d.confidence} />}
              {d.needsReview && <span className="text-xs text-yellow-400">⚠ needs review</span>}
              {d.previousStatus && (
                <span className="text-xs text-gray-600">{d.previousStatus} → {d.newStatus}</span>
              )}
            </div>
          </>
        ) : (
          <span className="text-sm text-gray-500">{d.reason || d.outcome}</span>
        )}
      </div>
      <span className={`text-xs shrink-0 ${meta.color}`}>{meta.label}</span>
    </div>
  );
}

export default function GmailPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [connected, setConnected] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [detailFilter, setDetailFilter] = useState('all');

  useEffect(() => {
    const connectedParam = searchParams.get('connected');
    const errorParam = searchParams.get('error');
    if (connectedParam === 'true') { toast.success('Gmail connected!'); setSearchParams({}); }
    else if (errorParam) { toast.error(`Auth error: ${decodeURIComponent(errorParam)}`); setSearchParams({}); }
  }, []);

  useEffect(() => {
    gmailApi.status()
      .then(({ connected, configured }) => { setConnected(connected); setConfigured(configured !== false); })
      .finally(() => setLoadingStatus(false));
    gmailApi.history().then(setHistory).catch(() => {});
  }, []);

  async function handleConnect() {
    try {
      const { url } = await gmailApi.authUrl();
      window.location.href = url;
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to get auth URL');
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
    const toastId = toast.loading('Scanning Gmail for job emails…');
    try {
      const result = await gmailApi.sync();
      setLastResult(result);
      toast.success(
        `Imported ${result.imported} new · ${result.updated} updated · ${result.unclassified} need review`,
        { id: toastId, duration: 5000 }
      );
      gmailApi.history().then(setHistory).catch(() => {});
    } catch (err) {
      toast.error(err.response?.data?.error || 'Sync failed', { id: toastId });
    } finally {
      setSyncing(false);
    }
  }

  const filteredDetails = lastResult?.details?.filter(d => {
    if (detailFilter === 'all') return true;
    if (detailFilter === 'review') return d.needsReview;
    if (detailFilter === 'imported') return d.outcome === 'imported';
    if (detailFilter === 'updated') return d.outcome === 'updated';
    if (detailFilter === 'skipped') return ['no_upgrade', 'duplicate_email', 'ignored'].includes(d.outcome);
    return true;
  }) || [];

  if (loadingStatus) return <div className="text-gray-500 py-12 text-center">Loading…</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Gmail Sync</h2>
        <p className="text-gray-500 text-sm mt-1">Auto-import and classify job emails from your inbox</p>
      </div>

      {/* Connection card */}
      <div className="card space-y-4">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500 shadow-[0_0_6px_theme(colors.green.500)]' : 'bg-gray-600'}`} />
          <span className="font-semibold text-white">{connected ? 'Gmail Connected' : 'Gmail Not Connected'}</span>
        </div>

        {!connected ? (
          <div className="space-y-3">
            <p className="text-gray-400 text-sm">
              Connect Gmail to auto-import application confirmations, rejections, interview invites, and offer letters. Scans last 90 days, all parsing runs locally — no paid APIs used.
            </p>
            <button className="btn-primary" onClick={handleConnect} disabled={!configured}>
              Connect Gmail →
            </button>

            {!configured && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 text-sm space-y-2">
                <p className="text-yellow-300 font-semibold">⚠ Google OAuth credentials required</p>
                <p className="text-gray-400">Add <code className="text-gray-300 bg-gray-800 px-1 rounded">GOOGLE_CLIENT_ID</code> and <code className="text-gray-300 bg-gray-800 px-1 rounded">GOOGLE_CLIENT_SECRET</code> to your <code className="text-gray-300 bg-gray-800 px-1 rounded">.env</code> file. The README has step-by-step instructions — it's free.</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-400">
              Scans the last <strong className="text-gray-300">90 days</strong> of emails. New companies are created automatically; existing ones are updated if the stage advances.
            </p>
            <div className="flex gap-3 flex-wrap">
              <button className="btn-primary" onClick={handleSync} disabled={syncing}>
                {syncing ? '⏳ Scanning inbox…' : '🔄 Sync Gmail'}
              </button>
              <button className="btn-secondary text-sm" onClick={handleDisconnect}>Disconnect</button>
            </div>
          </div>
        )}
      </div>

      {/* Last sync result */}
      {lastResult && (
        <div className="card space-y-4">
          <h3 className="font-semibold text-white">Sync Results</h3>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            {[
              { label: 'Scanned',       val: lastResult.scanned,      cls: 'text-gray-300' },
              { label: 'New Entries',   val: lastResult.imported,     cls: 'text-green-400' },
              { label: 'Status Updated',val: lastResult.updated,      cls: 'text-blue-400' },
              { label: 'Needs Review',  val: lastResult.unclassified, cls: 'text-yellow-400' },
            ].map(({ label, val, cls }) => (
              <div key={label} className="bg-gray-800 rounded-lg p-3">
                <div className={`text-2xl font-bold ${cls}`}>{val}</div>
                <div className="text-xs text-gray-500 mt-0.5">{label}</div>
              </div>
            ))}
          </div>

          {lastResult.details?.length > 0 && (
            <div className="space-y-2">
              {/* Filter tabs */}
              <div className="flex gap-1 flex-wrap">
                {[
                  ['all', `All (${lastResult.details.length})`],
                  ['imported', `New (${lastResult.imported})`],
                  ['updated', `Updated (${lastResult.updated})`],
                  ['review', `Review (${lastResult.unclassified})`],
                  ['skipped', `Skipped (${lastResult.skipped})`],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                      detailFilter === key
                        ? 'bg-brand-500/20 border-brand-500/40 text-brand-400'
                        : 'border-gray-700 text-gray-500 hover:text-gray-300'
                    }`}
                    onClick={() => setDetailFilter(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="bg-gray-800/60 rounded-lg px-3 max-h-80 overflow-y-auto">
                {filteredDetails.length === 0 ? (
                  <p className="text-xs text-gray-600 py-4 text-center">Nothing to show for this filter</p>
                ) : filteredDetails.map((d, i) => <DetailRow key={i} d={d} />)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sync history */}
      {history.length > 0 && (
        <div className="card space-y-3">
          <h3 className="font-semibold text-white">Sync History</h3>
          <div className="space-y-0">
            {history.map(log => (
              <div key={log.id} className="flex items-center justify-between py-2.5 border-b border-gray-800 last:border-0 text-sm">
                <span className="text-gray-500">{new Date(log.sync_date).toLocaleString()}</span>
                <div className="flex gap-3 text-xs">
                  <span className="text-green-400">+{log.jobs_imported}</span>
                  <span className="text-blue-400">↑{log.jobs_updated || 0}</span>
                  {log.unclassified > 0 && <span className="text-yellow-400">⚠{log.unclassified}</span>}
                  <span className="text-gray-600">{log.emails_scanned} scanned</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* How it works */}
      <div className="card space-y-3">
        <h3 className="font-semibold text-white">Classification Logic</h3>
        <div className="space-y-2 text-sm text-gray-400">
          {[
            ['✅ Applied',             'Confirmation keywords: "application received", "thank you for applying", etc.'],
            ['📞 Phone Screen',        'Scheduling keywords: "phone screen", "schedule a call", "calendly", etc.'],
            ['💻 Technical Interview', '"coding challenge", "hackerrank", "online assessment", "take-home assignment"'],
            ['🏁 Final Round',         '"final round", "on-site", "panel interview", "meet the team"'],
            ['🎉 Offer',               '"offer letter", "pleased to offer", "compensation package"'],
            ['❌ Rejected',            '"not moving forward", "after careful consideration", "not selected"'],
          ].map(([stage, desc]) => (
            <div key={stage} className="flex gap-2">
              <span className="shrink-0 font-medium text-gray-300 w-40">{stage}</span>
              <span className="text-gray-500">{desc}</span>
            </div>
          ))}
        </div>
        <div className="pt-2 border-t border-gray-800 space-y-1 text-xs text-gray-600">
          <p>• Status only advances — a stray confirmation email won't downgrade a "Final Round" entry</p>
          <p>• Confidence is based on phrase match count: <span className="text-green-400">High</span> (3+ matches), <span className="text-yellow-400">Medium</span> (2), <span className="text-red-400">Low</span> (1 / ambiguous)</p>
          <p>• Automated digests and newsletters are automatically filtered out</p>
          <p>• Calendar invites (.ics) are treated as interview confirmations</p>
          <p>• Access is read-only — no emails are modified or deleted</p>
        </div>
      </div>
    </div>
  );
}
