import type { SafetyTier } from "@/types/domain/safety";

const TIER_STYLES: Record<SafetyTier, string> = {
  GREEN: "border-safety-green/40 bg-safety-green/10 text-emerald-300",
  YELLOW: "border-safety-yellow/40 bg-safety-yellow/10 text-amber-300",
  RED: "border-safety-red/50 bg-safety-red/15 text-red-300",
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
      className={`inline-flex items-center rounded border px-2 py-0.5 font-mono text-xs uppercase ${TIER_STYLES[tier]}`}
    >
      {TIER_LABELS[tier]}
    </span>
  );
}
