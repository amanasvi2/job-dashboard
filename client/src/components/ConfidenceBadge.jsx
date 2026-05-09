const CONF_STYLES = {
  High:   'bg-green-500/15 text-green-400 ring-green-500/20',
  Medium: 'bg-yellow-500/15 text-yellow-400 ring-yellow-500/20',
  Low:    'bg-red-500/15 text-red-400 ring-red-500/20',
};

export default function ConfidenceBadge({ confidence }) {
  if (!confidence) return null;
  return (
    <span className={`badge ring-1 ring-inset text-[10px] ${CONF_STYLES[confidence] || CONF_STYLES.Low}`}>
      {confidence}
    </span>
  );
}
