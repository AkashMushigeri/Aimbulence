/**
 * Environment configuration boundary.
 *
 * Two distinct classes of configuration, deliberately kept apart:
 *
 *  - SERVER-ONLY  — read inside Node/server code only. Anything here is
 *                   available to the server render and must never be inlined
 *                   into the client bundle.
 *  - PUBLIC       — prefixed `NEXT_PUBLIC_`. Next.js inlines these into the
 *                   browser bundle, so only non-secret, non-sensitive values
 *                   may appear in this group.
 *
 * No secret, API key, token, or credential belongs in either group, and none
 * is defined here (`instruction.md` section 11). Backend credentials live
 * exclusively in the backend process.
 *
 * The backend base URL is treated as server-only. The browser talks to the
 * backend through same-origin calls proxied by Next.js, so no internal
 * `BACKEND_HOST` is ever disclosed to the client.
 */

export const PUBLIC_ENV_PREFIX = "NEXT_PUBLIC_";

export interface ServerConfig {
  /** Absolute backend origin, e.g. `http://localhost:8000`. Null when unset. */
  readonly backendBaseUrl: string | null;
  /** Default request timeout in milliseconds. */
  readonly requestTimeoutMs: number;
}

/** A `ServerConfig` that is guaranteed to carry a usable backend origin. */
export type ResolvedServerConfig = ServerConfig & { readonly backendBaseUrl: string };

/** Minimal environment shape. Avoids depending on framework-augmented ProcessEnv. */
export type EnvSource = Readonly<Record<string, string | undefined>>;

export interface PublicConfig {
  readonly appName: string;
  readonly appTagline: string;
}

const DEFAULT_TIMEOUT_MS = 10_000;

/** Strip trailing slashes so path joining stays predictable. */
export function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

/**
 * Build the backend origin from the project's documented variables.
 * `BACKEND_HOST` alone is insufficient because `0.0.0.0` is a bind address,
 * not a dialable destination for the browser or server-side fetches.
 */
function composeFromParts(host: string | undefined, port: string | undefined): string | null {
  if (!host || !port) {
    return null;
  }
  const isPortableBindAddress = host === "0.0.0.0" || host === "::";
  const dialableHost = isPortableBindAddress ? "localhost" : host;
  return `http://${dialableHost}:${port}`;
}

/**
 * Read server-side configuration. Returns a discriminated result rather than
 * throwing, so that a missing variable degrades predictably instead of
 * crashing module evaluation or the application shell.
 */
export function loadServerConfig(
  env: EnvSource = process.env,
): { ok: true; config: ResolvedServerConfig } | { ok: false; missing: readonly string[] } {
  const explicit = env.BACKEND_BASE_URL;
  const composed = composeFromParts(env.BACKEND_HOST, env.BACKEND_PORT);
  const backendBaseUrl = explicit ? normalizeBaseUrl(explicit) : composed;

  if (!backendBaseUrl) {
    return { ok: false, missing: ["BACKEND_BASE_URL or BACKEND_HOST + BACKEND_PORT"] };
  }

  const parsedTimeout = Number.parseInt(env.API_TIMEOUT_MS ?? "", 10);
  const requestTimeoutMs =
    Number.isFinite(parsedTimeout) && parsedTimeout > 0 ? parsedTimeout : DEFAULT_TIMEOUT_MS;

  return {
    ok: true,
    config: {
      backendBaseUrl: normalizeBaseUrl(backendBaseUrl),
      requestTimeoutMs,
    },
  };
}

/** Values safe to expose to the browser. Contains no host, port, or secret. */
export function loadPublicConfig(env: EnvSource = process.env): PublicConfig {
  return {
    appName: env[`${PUBLIC_ENV_PREFIX}APP_NAME`] ?? "AIMBULENCE",
    appTagline:
      env[`${PUBLIC_ENV_PREFIX}APP_TAGLINE`] ??
      "AI Emergency Hospital Operations Runbook Executor",
  };
}
