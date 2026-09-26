import type { SafetyTier } from "@/types/domain/safety";

const TIER_STYLES: Record<SafetyTier, string> = {
  GREEN: "border-emerald-300 bg-emerald-50 text-emerald-800 font-bold shadow-xs",
  YELLOW: "border-amber-300 bg-amber-50 text-amber-800 font-bold shadow-xs",
  RED: "border-red-600 bg-red-950 text-red-300 font-extrabold shadow-sm shadow-red-950/30",
};

const TIER_LABELS: Record<SafetyTier, string> = {
  GREEN: "GREEN · autonomous",
  YELLOW: "YELLOW · confirm",
  RED: "RED · human approval required",
};

/**
 * Renders the `instruction.md` section 6 safety classification.
 * RED is intentionally the loudest treatment: it is the only tier that must
 * never be actioned without a human decision.
 */
export function SafetyTierBadge({ tier }: { tier: SafetyTier }) {
  return (
    <span
      data-testid={`safety-tier-${tier}`}
      className={`inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-[11px] uppercase tracking-wide transition-all ${TIER_STYLES[tier]}`}
    >
      {TIER_LABELS[tier]}
    </span>
  );
}
