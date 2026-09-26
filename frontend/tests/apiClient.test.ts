import { describe, expect, it, vi } from "vitest";

import { ApiHttpError, ApiTimeoutError, ApiValidationError, MalformedResponseError } from "@/lib/errors";
import { buildQueryString, createApiClient } from "@/services/apiClient";

const CONFIG = { backendBaseUrl: "http://localhost:8000", requestTimeoutMs: 1_000 } as const;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Transport behaviour, exercised with an injected fetch stub.
 *
 * No real backend is contacted, and no response payload is invented as a
 * product fixture: every body used here is a shape documented in
 * `docs/api_contract.md`.
 */
describe("api client transport", () => {
  it("builds query strings and omits them when empty", () => {
    expect(buildQueryString({ limit: 50 })).toBe("?limit=50");
    expect(buildQueryString({})).toBe("");
    expect(buildQueryString(undefined)).toBe("");
  });

  it("returns parsed JSON for a successful response", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        status: "healthy",
        service: "aimbulence-backend",
        database: "connected",
        environment: "development",
        timestamp: "2026-09-26T12:00:00.000000Z",
      }),
    );
    const client = createApiClient({ config: CONFIG, fetchImpl });

    await expect(client.request("/api/health")).resolves.toMatchObject({ status: "healthy" });
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://localhost:8000/api/health",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("maps a 422 validation envelope onto a typed error", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse(
        {
          detail: "Request validation failed",
          errors: [{ field: "body -> casualty_count", message: "too small", type: "greater_than_equal" }],
        },
        422,
      ),
    );
    const client = createApiClient({ config: CONFIG, fetchImpl });

    await expect(client.request("/api/incidents", { method: "POST", body: {} })).rejects.toBeInstanceOf(
      ApiValidationError,
    );
  });

  it("maps a non-2xx response onto a typed HTTP error carrying the backend detail", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ detail: "Hospital operational baseline not initialized." }, 404));
    const client = createApiClient({ config: CONFIG, fetchImpl });

    await expect(client.request("/api/hospital/status")).rejects.toMatchObject({
      status: 404,
      message: "Hospital operational baseline not initialized.",
    });
  });

  it("raises a typed error for an unparseable success body", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response("not json", { status: 200 }));
    const client = createApiClient({ config: CONFIG, fetchImpl });

    await expect(client.request("/api/health")).rejects.toBeInstanceOf(MalformedResponseError);
  });

  it("wraps transport failures rather than swallowing them", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("connection refused"));
    const client = createApiClient({ config: CONFIG, fetchImpl });

    await expect(client.request("/api/health")).rejects.toMatchObject({ name: "ApiNetworkError" });
  });

  it("times out slow responses and clears its timer", async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        }),
    );
    const client = createApiClient({
      config: { backendBaseUrl: "http://localhost:8000", requestTimeoutMs: 10 },
      fetchImpl,
    });

    await expect(client.request("/api/health")).rejects.toBeInstanceOf(ApiTimeoutError);
  });

  it("propagates a non-JSON error body without crashing", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response("gateway down", { status: 502 }));
    const client = createApiClient({ config: CONFIG, fetchImpl });

    await expect(client.request("/api/health")).rejects.toBeInstanceOf(ApiHttpError);
  });
});
