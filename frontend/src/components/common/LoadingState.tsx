/** Explicit loading placeholder. Never substitutes placeholder figures for data. */
export function LoadingState({ label }: { label: string }) {
  return (
    <p
      data-testid="loading-state"
      aria-busy="true"
      className="rounded-xl border border-dashed border-[#d8d0c0] bg-[#fbf9f4] px-4 py-4 text-center font-mono text-xs sm:text-sm font-bold uppercase tracking-wider text-sky-800"
    >
      Loading {label}…
    </p>
  );
}
