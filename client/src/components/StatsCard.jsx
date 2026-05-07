export default function StatsCard({ label, value, sub, accent }) {
  return (
    <div className="card flex flex-col gap-1">
      <span className="text-xs uppercase tracking-widest text-gray-500 font-medium">{label}</span>
      <span className={`text-3xl font-bold ${accent || 'text-white'}`}>{value}</span>
      {sub && <span className="text-sm text-gray-500">{sub}</span>}
    </div>
  );
}
