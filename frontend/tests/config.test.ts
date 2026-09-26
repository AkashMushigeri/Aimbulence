import { describe, expect, it } from "vitest";

import { loadPublicConfig, loadServerConfig, normalizeBaseUrl, PUBLIC_ENV_PREFIX } from "@/lib/config";
import { ApiConfigurationError } from "@/lib/errors";
import { createApiClient } from "@/services/apiClient";

/**
 * Configuration safety.
 *
 * The client must never crash at module load when the backend is unconfigured,
 * must never silently invent a default origin, and must never leak a secret.
 */
describe("server configuration", () => {
  it("reports missing configuration instead of throwing at import time", () => {
    const result = loadServerConfig({});

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.missing).toContain("BACKEND_BASE_URL or BACKEND_HOST + BACKEND_PORT");
    }
  });

  it("requires both host and port when composing from parts", () => {
    expect(loadServerConfig({ BACKEND_HOST: "0.0.0.0" }).ok).toBe(false);
    expect(loadServerConfig({ BACKEND_PORT: "8000" }).ok).toBe(false);
  });

  it("prefers an explicit base URL and strips trailing slashes", () => {
    const result = loadServerConfig({
      BACKEND_BASE_URL: "http://localhost:8000/",
      BACKEND_HOST: "0.0.0.0",
      BACKEND_PORT: "8000",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config.backendBaseUrl).toBe("http://localhost:8000");
    }
  });

  it("rewrites the 0.0.0.0 bind address to a dialable host", () => {
    const result = loadServerConfig({ BACKEND_HOST: "0.0.0.0", BACKEND_PORT: "8000" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config.backendBaseUrl).toBe("http://localhost:8000");
    }
  });

  it("falls back to a default timeout and ignores invalid overrides", () => {
    const fallback = loadServerConfig({ BACKEND_BASE_URL: "http://localhost:8000" });
    const invalid = loadServerConfig({
      BACKEND_BASE_URL: "http://localhost:8000",
      API_TIMEOUT_MS: "not-a-number",
    });

    expect(fallback.ok && fallback.config.requestTimeoutMs).toBe(10_000);
    expect(invalid.ok && invalid.config.requestTimeoutMs).toBe(10_000);
  });

  it("normalises base URLs consistently", () => {
    expect(normalizeBaseUrl("http://localhost:8000///")).toBe("http://localhost:8000");
  });
});

describe("public configuration", () => {
  it("exposes no host, port, or secret", () => {
    const config = loadPublicConfig({});

    expect(Object.keys(config).sort()).toEqual(["appName", "appTagline"]);
    expect(JSON.stringify(config)).not.toMatch(/localhost|0\.0\.0\.0|:8000|key|token|secret/i);
  });

  it("reads only NEXT_PUBLIC_ prefixed variables", () => {
    const config = loadPublicConfig({
      [`${PUBLIC_ENV_PREFIX}APP_NAME`]: "AIMBULENCE",
      APP_NAME: "LEAKED",
      LLM_API_KEY: "sk-should-never-be-read",
    });

    expect(config.appName).toBe("AIMBULENCE");
    expect(JSON.stringify(config)).not.toContain("LEAKED");
    expect(JSON.stringify(config)).not.toContain("sk-should-never-be-read");
  });
});

describe("api client configuration safety", () => {
  it("fails with a typed configuration error rather than attempting a request", async () => {
    const client = createApiClient({ config: { backendBaseUrl: null, requestTimeoutMs: 1_000 } });

    expect(client.describe()).toEqual({
      configured: false,
      backendBaseUrl: null,
      timeoutMs: 1_000,
    });
    await expect(client.request("/api/health")).rejects.toBeInstanceOf(ApiConfigurationError);
  });

  it("does not throw merely because the environment is unconfigured", () => {
    const originalHost = process.env.BACKEND_HOST;
    const originalPort = process.env.BACKEND_PORT;
    const originalBase = process.env.BACKEND_BASE_URL;

    delete process.env.BACKEND_HOST;
    delete process.env.BACKEND_PORT;
    delete process.env.BACKEND_BASE_URL;

    try {
      expect(() => createApiClient()).not.toThrow();
    } finally {
      if (originalHost !== undefined) process.env.BACKEND_HOST = originalHost;
      if (originalPort !== undefined) process.env.BACKEND_PORT = originalPort;
      if (originalBase !== undefined) process.env.BACKEND_BASE_URL = originalBase;
    }
  });
});
