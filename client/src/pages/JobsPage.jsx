import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { jobsApi } from '../api/client.js';
import StatusBadge from '../components/StatusBadge.jsx';

const STATUSES = ['', 'Applied', 'Phone Screen', 'Technical Interview', 'Final Round', 'Offer', 'Rejected'];

export default function JobsPage() {
  const [jobs, setJobs] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sort, setSort] = useState('created_at');
  const [order, setOrder] = useState('DESC');
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);
  const fileRef = useRef();
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    jobsApi.list({ search, status: statusFilter, sort, order })
      .then(setJobs)
      .catch(() => toast.error('Failed to load jobs'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [search, statusFilter, sort, order]);

  async function deleteJob(id, company) {
    if (!confirm(`Delete ${company}?`)) return;
    setDeleting(id);
    try {
      await jobsApi.delete(id);
      toast.success('Deleted');
      setJobs(j => j.filter(j => j.id !== id));
    } catch { toast.error('Failed to delete'); }
    finally { setDeleting(null); }
  }

  async function handleCsvImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    const toastId = toast.loading('Importing CSV…');
    try {
      const { imported, errors, total } = await jobsApi.importCsv(file);
      toast.success(`Imported ${imported}/${total} jobs`, { id: toastId });
      if (errors.length) errors.forEach(err => toast.error(err, { duration: 4000 }));
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'CSV import failed', { id: toastId });
    }
    fileRef.current.value = '';
  }

  function toggleSort(col) {
    if (sort === col) setOrder(o => o === 'ASC' ? 'DESC' : 'ASC');
    else { setSort(col); setOrder('ASC'); }
  }

  const SortTh = ({ col, label }) => (
    <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-gray-500 cursor-pointer hover:text-gray-300 select-none" onClick={() => toggleSort(col)}>
      {label} {sort === col && (order === 'ASC' ? '↑' : '↓')}
    </th>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <h2 className="text-2xl font-bold text-white">Applications</h2>
        <div className="flex gap-2">
          <input type="file" accept=".csv" ref={fileRef} onChange={handleCsvImport} className="hidden" />
          <button className="btn-secondary text-sm" onClick={() => fileRef.current.click()}>Import CSV</button>
          <Link to="/jobs/new" className="btn-primary text-sm">+ Add Job</Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          className="input max-w-xs text-sm"
          placeholder="Search company or title…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className="input w-auto text-sm" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          {STATUSES.map(s => <option key={s} value={s}>{s || 'All Statuses'}</option>)}
        </select>
      </div>

      {/* CSV hint */}
      <details className="text-xs text-gray-500">
        <summary className="cursor-pointer hover:text-gray-400">CSV format help</summary>
        <p className="mt-1 pl-2 text-gray-600">
          Required columns: <code className="text-gray-400">company, job_title</code>. Optional: <code className="text-gray-400">application_date, status, notes, job_posting_url, salary_range, contact_name, contact_email, next_follow_up</code>
        </p>
      </details>

      {/* Table */}
      <div className="card p-0 overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-gray-800">
            <tr>
              <SortTh col="company" label="Company" />
              <SortTh col="job_title" label="Role" />
              <SortTh col="status" label="Status" />
              <SortTh col="application_date" label="Applied" />
              <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-gray-500">Follow-up</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {loading ? (
              <tr><td colSpan={6} className="text-center py-12 text-gray-500">Loading…</td></tr>
            ) : jobs.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-gray-500">
                  No applications found.{' '}
                  <Link to="/jobs/new" className="text-brand-400 hover:underline">Add your first one</Link>
                </td>
              </tr>
            ) : jobs.map(job => (
              <tr key={job.id} className="hover:bg-gray-800/50 transition-colors">
                <td className="px-4 py-3">
                  <div className="font-medium text-white">{job.company}</div>
                  {job.salary_range && <div className="text-xs text-gray-500">{job.salary_range}</div>}
                </td>
                <td className="px-4 py-3">
                  <div className="text-sm text-gray-200">{job.job_title}</div>
                  {job.job_posting_url && (
                    <a href={job.job_posting_url} target="_blank" rel="noreferrer" className="text-xs text-brand-400 hover:underline">View posting ↗</a>
                  )}
                </td>
                <td className="px-4 py-3"><StatusBadge status={job.status} /></td>
                <td className="px-4 py-3 text-sm text-gray-400">{job.application_date}</td>
                <td className="px-4 py-3 text-sm text-gray-400">
                  {job.next_follow_up || <span className="text-gray-700">—</span>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 justify-end">
                    <button
                      className="text-xs text-brand-400 hover:text-brand-300"
                      onClick={() => navigate(`/jobs/${job.id}/edit`)}
                    >Edit</button>
                    <button
                      className="text-xs text-red-500 hover:text-red-400"
                      onClick={() => deleteJob(job.id, job.company)}
                      disabled={deleting === job.id}
                    >Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {jobs.length > 0 && (
        <p className="text-xs text-gray-600 text-right">{jobs.length} application{jobs.length !== 1 ? 's' : ''}</p>
      )}
    </div>
  );
}
