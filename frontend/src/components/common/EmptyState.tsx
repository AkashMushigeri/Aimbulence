import type { ReactNode } from "react";

/**
 * Explicit empty state.
 *
 * Used wherever live operational data would normally render but has not been
 * connected yet. `instruction.md` section 19 forbids presenting unwritten or
 * unconnected capability as if it were working, so every such surface states
 * its own absence rather than showing placeholder figures.
 */
export function EmptyState({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div
      data-testid="empty-state"
      className="rounded border border-dashed border-surface-border bg-surface/40 px-4 py-6 text-center"
    >
      <p className="text-sm font-medium text-slate-300">{title}</p>
      {children ? <div className="mt-2 text-sm text-slate-400">{children}</div> : null}
    </div>
  );
}
