import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DndContext, DragOverlay, closestCorners, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import toast from 'react-hot-toast';
import { jobsApi } from '../api/client.js';
import ConfidenceBadge from '../components/ConfidenceBadge.jsx';

const COLUMNS = ['Applied', 'Phone Screen', 'Technical Interview', 'Final Round', 'Offer', 'Rejected'];

const COLUMN_ACCENT = {
  Applied: 'border-blue-500/40',
  'Phone Screen': 'border-yellow-500/40',
  'Technical Interview': 'border-purple-500/40',
  'Final Round': 'border-orange-500/40',
  Offer: 'border-green-500/40',
  Rejected: 'border-red-500/40',
};

function formatDate(d) {
  if (!d) return null;
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function JobCard({ job, isDragging, navigate }) {
  const needsReview = job.needs_review && job.source?.startsWith('gmail');
  return (
    <div
      className={`rounded-lg p-3 select-none transition-all border ${
        needsReview
          ? 'bg-yellow-500/5 border-yellow-500/30'
          : 'bg-gray-800 border-gray-700 hover:border-gray-600'
      } ${isDragging ? 'shadow-2xl shadow-brand-500/20 opacity-90 rotate-1 scale-105 cursor-grabbing' : 'cursor-grab'}`}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="font-semibold text-white text-sm truncate leading-tight">{job.company}</div>
        {needsReview && <span className="text-yellow-400 text-xs shrink-0">⚠</span>}
      </div>
      <div className="text-xs text-gray-400 mt-0.5 truncate">{job.job_title}</div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {job.confidence && job.source?.startsWith('gmail') && (
          <ConfidenceBadge confidence={job.confidence} />
        )}
      </div>

      <div className="mt-2 space-y-0.5">
        {job.status_changed_date && (
          <div className="flex items-center justify-between text-xs text-gray-600">
            <span>Stage changed</span>
            <span>{formatDate(job.status_changed_date)}</span>
          </div>
        )}
        {job.last_email_date && (
          <div className="flex items-center justify-between text-xs text-gray-600">
            <span>Last email</span>
            <span>{formatDate(job.last_email_date)}</span>
          </div>
        )}
        {job.next_follow_up && (
          <div className="flex items-center justify-between text-xs text-orange-400/80">
            <span>Follow-up</span>
            <span>{formatDate(job.next_follow_up)}</span>
          </div>
        )}
        {job.salary_range && (
          <div className="text-xs text-gray-600 truncate">{job.salary_range}</div>
        )}
      </div>

      <button
        className="mt-2 text-xs text-brand-400 hover:text-brand-300 hover:underline"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); navigate(`/jobs/${job.id}/edit`); }}
      >
        Edit →
      </button>
    </div>
  );
}

function SortableCard({ job, navigate }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: job.id,
    data: { type: 'card', status: job.status },
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? 'opacity-30' : ''}
      {...attributes}
      {...listeners}
    >
      <JobCard job={job} isDragging={false} navigate={navigate} />
    </div>
  );
}

function Column({ status, jobs, navigate }) {
  const { setNodeRef, isOver } = useDroppable({ id: status, data: { type: 'column', status } });
  const reviewCount = jobs.filter(j => j.needs_review).length;

  return (
    <div className={`flex flex-col min-w-[240px] w-64 shrink-0 rounded-xl border-t-2 transition-colors ${
      COLUMN_ACCENT[status]} ${isOver ? 'bg-gray-800/80' : 'bg-gray-900'}`}
    >
      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between gap-2">
        <span className="font-semibold text-sm text-gray-200 truncate">{status}</span>
        <div className="flex items-center gap-1 shrink-0">
          {reviewCount > 0 && (
            <span className="text-[10px] bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded-full px-1.5">⚠{reviewCount}</span>
          )}
          <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">{jobs.length}</span>
        </div>
      </div>
      <SortableContext items={jobs.map(j => j.id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="flex flex-col gap-2 p-3 min-h-[120px] flex-1">
          {jobs.map(job => (
            <SortableCard key={job.id} job={job} navigate={navigate} />
          ))}
          {jobs.length === 0 && (
            <div className={`text-center text-xs py-6 rounded-lg border-2 border-dashed transition-colors ${
              isOver ? 'border-gray-600 text-gray-500' : 'border-gray-800 text-gray-700'
            }`}>Drop here</div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

export default function KanbanPage() {
  const [jobs, setJobs] = useState([]);
  const [activeJob, setActiveJob] = useState(null);
  const navigate = useNavigate();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  useEffect(() => {
    jobsApi.list({}).then(setJobs).catch(() => toast.error('Failed to load jobs'));
  }, []);

  const byStatus = (status) => jobs.filter(j => j.status === status);
  const reviewTotal = jobs.filter(j => j.needs_review).length;

  async function handleDragEnd({ active, over }) {
    setActiveJob(null);
    if (!over) return;

    const activeId = active.id;
    const overData = over.data?.current;
    const activeData = active.data?.current;

    let targetStatus;
    if (overData?.type === 'column') targetStatus = overData.status;
    else if (overData?.type === 'card') targetStatus = overData.status;
    else if (COLUMNS.includes(over.id)) targetStatus = over.id;
    else targetStatus = jobs.find(j => j.id === over.id)?.status;

    if (!targetStatus) return;
    const currentStatus = activeData?.status || jobs.find(j => j.id === activeId)?.status;
    if (currentStatus === targetStatus) return;

    const today = new Date().toISOString().split('T')[0];
    setJobs(prev => prev.map(j =>
      j.id === activeId ? { ...j, status: targetStatus, status_changed_date: today } : j
    ));

    try {
      await jobsApi.update(activeId, { status: targetStatus });
      toast.success(`→ ${targetStatus}`, { duration: 1500 });
    } catch {
      toast.error('Failed to update status');
      setJobs(prev => prev.map(j => j.id === activeId ? { ...j, status: currentStatus } : j));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white">Kanban Board</h2>
          <p className="text-gray-500 text-sm mt-1">Drag cards between columns to update status</p>
        </div>
        <div className="flex items-center gap-3">
          {reviewTotal > 0 && (
            <span className="text-xs bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 rounded-full px-3 py-1">
              ⚠ {reviewTotal} need{reviewTotal === 1 ? 's' : ''} review
            </span>
          )}
          <span className="text-sm text-gray-500">{jobs.length} total</span>
        </div>
      </div>

      <div className="overflow-x-auto pb-4 -mx-4 px-4">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={({ active }) => setActiveJob(jobs.find(j => j.id === active.id))}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 min-w-max">
            {COLUMNS.map(status => (
              <Column key={status} status={status} jobs={byStatus(status)} navigate={navigate} />
            ))}
          </div>

          <DragOverlay dropAnimation={{ duration: 150, easing: 'ease' }}>
            {activeJob ? <JobCard job={activeJob} isDragging navigate={navigate} /> : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}
