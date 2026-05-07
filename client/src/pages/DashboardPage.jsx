import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { statsApi } from '../api/client.js';
import StatsCard from '../components/StatsCard.jsx';
import StatusBadge from '../components/StatusBadge.jsx';

const STATUS_COLORS = {
  Applied: '#3b82f6', 'Phone Screen': '#eab308', 'Technical Interview': '#a855f7',
  'Final Round': '#f97316', Offer: '#22c55e', Rejected: '#ef4444',
};

const TOOLTIP_STYLE = {
  backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px', color: '#f3f4f6',
};

function FollowUpCard({ job }) {
  const days = Math.ceil((new Date(job.next_follow_up) - new Date()) / 86400000);
  const urgent = days <= 1;
  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border ${urgent ? 'border-orange-500/30 bg-orange-500/5' : 'border-gray-800 bg-gray-900'}`}>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-white truncate">{job.company}</p>
        <p className="text-sm text-gray-400 truncate">{job.job_title}</p>
      </div>
      <div className="text-right shrink-0">
        <StatusBadge status={job.status} />
        <p className={`text-xs mt-1 ${urgent ? 'text-orange-400' : 'text-gray-500'}`}>
          {days === 0 ? 'Today' : days < 0 ? `${Math.abs(days)}d overdue` : `in ${days}d`}
        </p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    statsApi.get().then(setStats).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-500">Loading dashboard…</div>;
  if (!stats) return <div className="text-red-400">Failed to load stats</div>;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Dashboard</h2>
          <p className="text-gray-500 text-sm mt-1">Your job search at a glance</p>
        </div>
        <Link to="/jobs/new" className="btn-primary text-sm">+ Add Job</Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard label="Total Apps" value={stats.total} sub="all time" />
        <StatsCard label="Response Rate" value={`${stats.responseRate}%`} sub="heard back" accent="text-blue-400" />
        <StatsCard label="Interview Rate" value={`${stats.interviewRate}%`} sub="got interviews" accent="text-purple-400" />
        <StatsCard label="Offer Rate" value={`${stats.offerRate}%`} sub="of applications" accent="text-green-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Applications */}
        <div className="card lg:col-span-2">
          <h3 className="font-semibold text-white mb-4">Applications by Month</h3>
          {stats.applicationsByMonth.length === 0 ? (
            <p className="text-gray-500 text-sm py-8 text-center">No data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats.applicationsByMonth} barSize={28}>
                <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                <Bar dataKey="count" fill="#4d6fff" radius={[4, 4, 0, 0]} name="Applications" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* By Status Pie */}
        <div className="card">
          <h3 className="font-semibold text-white mb-4">By Status</h3>
          {stats.byStatus.length === 0 ? (
            <p className="text-gray-500 text-sm py-8 text-center">No data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={stats.byStatus}
                  dataKey="count"
                  nameKey="status"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                >
                  {stats.byStatus.map((entry) => (
                    <Cell key={entry.status} fill={STATUS_COLORS[entry.status] || '#6b7280'} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, n) => [v, n]} />
                <Legend
                  formatter={(v) => <span style={{ color: '#9ca3af', fontSize: '11px' }}>{v}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Follow-ups */}
        <div className="card">
          <h3 className="font-semibold text-white mb-4">⏰ Upcoming Follow-ups</h3>
          {stats.upcomingFollowUps.length === 0 ? (
            <p className="text-gray-500 text-sm">No follow-ups scheduled</p>
          ) : (
            <div className="space-y-2">
              {stats.upcomingFollowUps.map(j => <FollowUpCard key={j.id} job={j} />)}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="card">
          <h3 className="font-semibold text-white mb-4">🕐 Recent Activity</h3>
          <div className="space-y-3">
            {stats.recentActivity.length === 0 ? (
              <p className="text-gray-500 text-sm">No applications yet. <Link to="/jobs/new" className="text-brand-400 hover:underline">Add one</Link></p>
            ) : stats.recentActivity.map(job => (
              <div key={job.id} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{job.company}</p>
                  <p className="text-xs text-gray-500 truncate">{job.job_title}</p>
                </div>
                <StatusBadge status={job.status} />
              </div>
            ))}
          </div>
          {stats.recentActivity.length > 0 && (
            <Link to="/jobs" className="block text-center text-xs text-brand-400 hover:underline mt-4">
              View all applications →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
