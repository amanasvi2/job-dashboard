const STATUS_COLORS = {
  'Applied':              'bg-blue-500/15 text-blue-400 ring-blue-500/20',
  'Phone Screen':         'bg-yellow-500/15 text-yellow-400 ring-yellow-500/20',
  'Technical Interview':  'bg-purple-500/15 text-purple-400 ring-purple-500/20',
  'Final Round':          'bg-orange-500/15 text-orange-400 ring-orange-500/20',
  'Offer':                'bg-green-500/15 text-green-400 ring-green-500/20',
  'Rejected':             'bg-red-500/15 text-red-400 ring-red-500/20',
};

export default function StatusBadge({ status }) {
  const cls = STATUS_COLORS[status] || 'bg-gray-700 text-gray-300';
  return (
    <span className={`badge ring-1 ring-inset ${cls}`}>{status}</span>
  );
}
