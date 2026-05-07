import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { jobsApi } from '../api/client.js';

const STATUSES = ['Applied', 'Phone Screen', 'Technical Interview', 'Final Round', 'Offer', 'Rejected'];

const EMPTY = {
  company: '', job_title: '', application_date: new Date().toISOString().split('T')[0],
  status: 'Applied', notes: '', job_posting_url: '', salary_range: '',
  contact_name: '', contact_email: '', next_follow_up: '', interview_link: '',
};

export default function JobForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEdit);

  useEffect(() => {
    if (!isEdit) return;
    jobsApi.get(id)
      .then(job => setForm({ ...EMPTY, ...job, next_follow_up: job.next_follow_up || '', interview_link: job.interview_link || '' }))
      .catch(() => { toast.error('Job not found'); navigate('/jobs'); })
      .finally(() => setFetching(false));
  }, [id]);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    if (!form.company.trim() || !form.job_title.trim()) {
      return toast.error('Company and job title are required');
    }
    setLoading(true);
    try {
      if (isEdit) {
        await jobsApi.update(id, form);
        toast.success('Job updated');
      } else {
        await jobsApi.create(form);
        toast.success('Job added');
      }
      navigate('/jobs');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save job');
    } finally {
      setLoading(false);
    }
  }

  if (fetching) return <div className="text-gray-500 py-8 text-center">Loading…</div>;

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Company *</label>
          <input className="input" value={form.company} onChange={set('company')} placeholder="Acme Corp" />
        </div>
        <div>
          <label className="label">Job Title *</label>
          <input className="input" value={form.job_title} onChange={set('job_title')} placeholder="Software Engineer" />
        </div>
        <div>
          <label className="label">Application Date</label>
          <input type="date" className="input" value={form.application_date} onChange={set('application_date')} />
        </div>
        <div>
          <label className="label">Status</label>
          <select className="input" value={form.status} onChange={set('status')}>
            {STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Job Posting URL</label>
          <input className="input" value={form.job_posting_url} onChange={set('job_posting_url')} placeholder="https://..." />
        </div>
        <div>
          <label className="label">Salary Range</label>
          <input className="input" value={form.salary_range} onChange={set('salary_range')} placeholder="$120k–$150k" />
        </div>
        <div>
          <label className="label">Contact Name</label>
          <input className="input" value={form.contact_name} onChange={set('contact_name')} placeholder="Jane Smith" />
        </div>
        <div>
          <label className="label">Contact Email</label>
          <input type="email" className="input" value={form.contact_email} onChange={set('contact_email')} placeholder="jane@acme.com" />
        </div>
        <div>
          <label className="label">Next Follow-up Date</label>
          <input type="date" className="input" value={form.next_follow_up} onChange={set('next_follow_up')} />
        </div>
        <div>
          <label className="label">Interview Link</label>
          <input className="input" value={form.interview_link} onChange={set('interview_link')} placeholder="https://calendly.com/..." />
        </div>
      </div>

      <div>
        <label className="label">Notes</label>
        <textarea className="input min-h-[100px] resize-y" value={form.notes} onChange={set('notes')} placeholder="Any notes…" />
      </div>

      <div className="flex gap-3 pt-2">
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Job'}
        </button>
        <button type="button" className="btn-secondary" onClick={() => navigate('/jobs')}>
          Cancel
        </button>
      </div>
    </form>
  );
}
