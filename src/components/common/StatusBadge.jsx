export default function StatusBadge({ status }) {
  const styles = {
    Active:   'bg-green-500/20 text-green-400 border-green-500/30',
    Inactive: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
    Disabled: 'bg-red-500/20 text-red-400 border-red-500/30',
  };
  return (
    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border ${styles[status] || styles.Inactive}`}>
      {status}
    </span>
  );
}
