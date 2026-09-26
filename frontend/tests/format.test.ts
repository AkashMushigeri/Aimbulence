import { describe, expect, it } from "vitest";

import {
  clamp,
  computeDeficit,
  formatCount,
  formatDeficit,
  formatPercent,
  formatRelativeAge,
  formatTimestamp,
} from "@/lib/format";

describe("formatTimestamp", () => {
  it("renders an ISO timestamp in a console-friendly form", () => {
    expect(formatTimestamp("2026-09-26T12:00:00.000000Z")).toBe("2026-09-26 12:00:00Z");
  });

  it("passes through an unparseable value rather than throwing", () => {
    expect(formatTimestamp("not-a-date")).toBe("not-a-date");
  });
});

describe("formatRelativeAge", () => {
  const now = Date.parse("2026-09-26T12:00:00Z");

  it("reports recent snapshots in minutes and hours", () => {
    expect(formatRelativeAge("2026-09-26T11:59:30Z", now)).toBe("just now");
    expect(formatRelativeAge("2026-09-26T11:56:00Z", now)).toBe("4m ago");
    expect(formatRelativeAge("2026-09-26T09:00:00Z", now)).toBe("3h ago");
    expect(formatRelativeAge("2026-09-24T12:00:00Z", now)).toBe("2d ago");
  });

  it("does not produce negative ages for clock skew", () => {
    expect(formatRelativeAge("2026-09-26T12:05:00Z", now)).toBe("just now");
  });

  it("degrades safely on an unparseable timestamp", () => {
    expect(formatRelativeAge("nope", now)).toBe("unknown");
  });
});

describe("deficit arithmetic", () => {
  it("reports a shortfall as a positive deficit", () => {
    expect(computeDeficit(42, 12)).toBe(30);
    expect(formatDeficit(42, 12)).toBe("deficit 30");
  });

  it("reports spare capacity as headroom", () => {
    expect(computeDeficit(2, 5)).toBe(-3);
    expect(formatDeficit(2, 5)).toBe("headroom 3");
  });

  it("reports an exact match as balanced", () => {
    expect(formatDeficit(4, 4)).toBe("balanced");
  });
});

describe("formatting helpers", () => {
  it("pluralises counts", () => {
    expect(formatCount(1, "bed")).toBe("1 bed");
    expect(formatCount(4, "bed")).toBe("4 beds");
  });

  it("formats percentages and rejects an unusable denominator", () => {
    expect(formatPercent(12, 20)).toBe("60%");
    expect(formatPercent(5, 0)).toBeNull();
    expect(formatPercent(Number.NaN, 10)).toBeNull();
  });

  it("clamps into range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(99, 0, 10)).toBe(10);
  });
});
