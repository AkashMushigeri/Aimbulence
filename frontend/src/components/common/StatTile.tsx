/** Compact read-only metric display. Renders only values supplied by the caller. */
export function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-[#e5dfd2] bg-[#fbf9f4] p-4 shadow-sm hover:shadow-md hover:border-[#d8d0c0] transition-all duration-200">
      <p className="text-xs font-mono font-bold uppercase tracking-wider text-stone-600">{label}</p>
      <p className="mt-1 font-mono text-2xl sm:text-3xl font-black tracking-tight text-stone-900">{value}</p>
      {hint ? <p className="mt-1 text-xs sm:text-[13px] text-stone-600 font-medium">{hint}</p> : null}
    </div>
  );
}
