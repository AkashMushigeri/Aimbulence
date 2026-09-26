import type { ReactNode } from "react";

/** Raised surface container used to group operator-console content. */
export function Panel({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  /** Optional status control rendered opposite the title. */
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[#e5dfd2] bg-[#fffdf9] p-5 sm:p-6 shadow-sm hover:shadow-md transition-all duration-300 hover:border-[#d8d0c0]">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#ece5d8] pb-3.5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-sky-600 shadow-[0_0_8px_rgba(2,132,199,0.4)] animate-pulse" />
            <h2 className="font-mono text-sm sm:text-[15px] font-extrabold uppercase tracking-wide text-stone-900">{title}</h2>
          </div>
          {description ? <p className="text-xs sm:text-[13px] text-stone-600 font-medium leading-relaxed">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
    </section>
  );
}
