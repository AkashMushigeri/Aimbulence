import { describe, expect, it, vi } from "vitest";

import { ApiNetworkError, ApiTimeoutError } from "@/lib/errors";
import { loadSections } from "@/lib/loadState";

/**
 * Aggregation behaviour for the console's independent sections.
 *
 * The critical property is that one failing endpoint must not mask a succeeding
 * one, and must never be reported as an overall success.
 */
describe("loadSections", () => {
  it("marks each section available when every endpoint succeeds", async () => {
    const sections = await loadSections([
      { key: "health", label: "System status", load: async () => "ok" },
      { key: "incidents", label: "Incidents", load: async () => [] },
    ]);

    expect(sections.health?.state.status).toBe("available");
    expect(sections.incidents?.state.status).toBe("available");
  });

  it("reports a partial failure without discarding the successful section", async () => {
    const sections = await loadSections([
      { key: "health", label: "System status", load: async () => "ok" },
      {
        key: "hospital",
        label: "Hospital status",
        load: async () => {
          throw new ApiNetworkError("connection refused");
        },
      },
    ]);

    expect(sections.health?.state.status).toBe("available");
    expect(sections.hospital?.state.status).toBe("failed");
    expect(
      sections.hospital?.state.status === "failed" ? sections.hospital.state.error.kind : null,
    ).toBe("NETWORK");
  });

  it("never rejects, even when every loader throws", async () => {
    const sections = await loadSections([
      {
        key: "a",
        label: "A",
        load: async () => {
          throw new ApiTimeoutError("timed out", 100);
        },
      },
      {
        key: "b",
        label: "B",
        load: async () => {
          throw new Error("unexpected");
        },
      },
    ]);

    expect(sections.a?.state.status).toBe("failed");
    expect(sections.b?.state.status).toBe("failed");
  });

  it("converts an untyped throw into the typed error hierarchy", async () => {
    const sections = await loadSections([
      {
        key: "a",
        label: "A",
        load: async () => {
          throw new Error("plain failure");
        },
      },
    ]);

    expect(
      sections.a?.state.status === "failed" ? sections.a.state.error.kind : null,
    ).toBe("NETWORK");
  });

  it("preserves the loaded-at timestamp for staleness display", async () => {
    const sections = await loadSections([
      { key: "a", label: "A", load: async () => "value" },
    ]);

    const state = sections.a?.state;
    expect(state?.status).toBe("available");
    if (state?.status === "available") {
      expect(Date.parse(state.loadedAt)).not.toBeNaN();
    }
  });

  it("keeps section labels for operator-facing error copy", async () => {
    const sections = await loadSections([
      { key: "audit", label: "Audit trail", load: async () => vi.fn()() },
    ]);

    expect(sections.audit?.label).toBe("Audit trail");
  });
});
