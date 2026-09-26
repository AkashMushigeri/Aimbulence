/** Explicit loading placeholder. Never substitutes placeholder figures for data. */
export function LoadingState({ label }: { label: string }) {
  return (
    <p
      data-testid="loading-state"
      aria-busy="true"
      className="rounded border border-dashed border-surface-border px-4 py-4 text-center font-mono text-xs uppercase tracking-wide text-sky-300"
    >
      Loading {label}…
    </p>
  );
}
