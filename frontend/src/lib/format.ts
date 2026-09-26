/**
 * Pure presentation utilities.
 *
 * Deterministic formatting only — no LLM involvement, no data fetching
 * (`instruction.md` section 21 prefers deterministic code for arithmetic).
 */

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/** Render an ISO-8601 timestamp for the operator console. */
export function formatTimestamp(iso: string): string {
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) {
    return iso;
  }
  return new Date(parsed).toISOString().replace("T", " ").replace(/\.\d+Z$/, "Z");
}

/** Compact "how stale is this snapshot" label, e.g. `4m ago`. */
export function formatRelativeAge(iso: string, now: number = Date.now()): string {
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) {
    return "unknown";
  }
  const delta = Math.max(0, now - parsed);
  if (delta < MINUTE_MS) return "just now";
  if (delta < HOUR_MS) return `${Math.floor(delta / MINUTE_MS)}m ago`;
  if (delta < DAY_MS) return `${Math.floor(delta / HOUR_MS)}h ago`;
  return `${Math.floor(delta / DAY_MS)}d ago`;
}

/**
 * Signed capacity gap: positive means a shortfall, negative means headroom.
 * This is the arithmetic the agent's sandbox computes; the UI only presents it.
 */
export function computeDeficit(required: number, available: number): number {
  return required - available;
}

export function formatDeficit(required: number, available: number): string {
  const deficit = computeDeficit(required, available);
  if (deficit > 0) {
    return `deficit ${deficit}`;
  }
  if (deficit < 0) {
    return `headroom ${Math.abs(deficit)}`;
  }
  return "balanced";
}

export function formatCount(value: number, noun: string): string {
  return `${value.toLocaleString("en-US")} ${noun}${value === 1 ? "" : "s"}`;
}

/** `0.5` -> `50%`. Clamped to 0-100; returns `null` for an unusable denominator. */
export function formatPercent(part: number, whole: number): string | null {
  if (!Number.isFinite(part) || !Number.isFinite(whole) || whole <= 0) {
    return null;
  }
  const ratio = Math.min(1, Math.max(0, part / whole));
  return `${Math.round(ratio * 100)}%`;
}

/** Clamp a number into an inclusive range. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
