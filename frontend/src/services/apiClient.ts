/**
 * Centralized HTTP client foundation.
 *
 * SCOPE — Phase 1 foundation only. This module provides typed transport,
 * configuration resolution, timeouts, and structured error mapping. It
 * deliberately exposes NO endpoint-specific functions (`getIncidents()`,
 * `postApprovalDecision()`, etc.) and hard-codes NO paths. Endpoint wrappers
 * belong in dedicated service modules and are Phase 3/4/6 work, by which point
 * the corresponding backend contracts must be served.
 *
 * Documented paths live in `src/types/api/contracts.ts` as constants only.
 *
 * SECURITY — the backend origin is server-only configuration. This client is
 * intended to run in Node (server components, route handlers, server actions)
 * so that `BACKEND_HOST` is never disclosed to the browser. No secret, token,
 * or credential is read, stored, or forwarded here.
 */
import { loadServerConfig, type ResolvedServerConfig, type ServerConfig } from "@/lib/config";
import {
  ApiConfigurationError,
  ApiHttpError,
  ApiNetworkError,
  ApiTimeoutError,
  ApiValidationError,
  MalformedResponseError,
  type ApiErrorKind,
} from "@/lib/errors";
import type { ApiErrorDetailWire, ApiValidationErrorWire } from "@/types/api/contracts";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface RequestOptions {
  readonly method?: HttpMethod;
  /** Parsed as JSON and sent with a `Content-Type: application/json` header. */
  readonly body?: unknown;
  /** Appended verbatim; caller supplies any query string. */
  readonly query?: Readonly<Record<string, string | number | boolean>>;
  /** Overrides the client-level timeout for this call. */
  readonly timeoutMs?: number;
  /** Caller-owned cancellation, composed with the internal timeout signal. */
  readonly signal?: AbortSignal;
  /** Extra headers. Never used to inject credentials. */
  readonly headers?: Readonly<Record<string, string>>;
}

export interface ApiClient {
  request<TResponse>(path: string, options?: RequestOptions): Promise<TResponse>;
  /** Read-only accessor for diagnostics and tests. Never exposes secrets. */
  describe(): { configured: boolean; backendBaseUrl: string | null; timeoutMs: number };
}

/** Raised when the backend base URL is not configured. */
export function assertConfigured(
  config: ServerConfig | null,
): asserts config is ResolvedServerConfig {
  if (!config || !config.backendBaseUrl) {
    throw new ApiConfigurationError(
      "Backend base URL is not configured. Set BACKEND_BASE_URL, or BACKEND_HOST together with BACKEND_PORT.",
    );
  }
}

export function buildQueryString(query: RequestOptions["query"]): string {
  if (!query) {
    return "";
  }
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    params.append(key, String(value));
  }
  const serialized = params.toString();
  return serialized.length > 0 ? `?${serialized}` : "";
}

function joinUrl(baseUrl: string, path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${baseUrl}${normalizedPath}`;
}

/**
 * Compose several abort signals into one.
 *
 * `AbortSignal.any()` is not available in every runtime this client may be
 * exercised in (notably jsdom and Node < 20), so the composition is done
 * explicitly rather than depending on a newer platform API.
 */
export function combineSignals(signals: readonly AbortSignal[]): AbortSignal {
  const first = signals[0];
  if (!first) {
    return new AbortController().signal;
  }
  if (signals.length === 1) {
    return first;
  }

  const controller = new AbortController();
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      return controller.signal;
    }
    signal.addEventListener("abort", () => controller.abort(signal.reason), { once: true });
  }
  return controller.signal;
}

/** Map an HTTP failure body onto the typed error hierarchy. */
async function toHttpError(response: Response): Promise<ApiHttpError | ApiValidationError> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return new ApiHttpError(
      response.status,
      `Backend returned ${response.status} with a non-JSON body.`,
      { statusText: response.statusText },
    );
  }

  const validation = body as Partial<ApiValidationErrorWire>;
  if (response.status === 422 && Array.isArray(validation.errors)) {
    return new ApiValidationError(validation.detail ?? "Request validation failed", validation.errors);
  }

  const detailEnvelope = body as Partial<ApiErrorDetailWire>;
  const detail = detailEnvelope?.detail;
  const message = typeof detail === "string" ? detail : `Backend returned ${response.status}.`;
  return new ApiHttpError(response.status, message, detail);
}

export interface CreateApiClientOptions {
  /** Injected for tests; defaults to reading the server environment. */
  readonly config?: ServerConfig;
  /** Injected for tests; defaults to global fetch. */
  readonly fetchImpl?: typeof fetch;
}

export function createApiClient(options: CreateApiClientOptions = {}): ApiClient {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const loaded = options.config ? { ok: true as const, config: options.config } : loadServerConfig();
  const config: ServerConfig | null = loaded.ok ? loaded.config : null;
  const defaultTimeoutMs = config?.requestTimeoutMs ?? 10_000;

  async function request<TResponse>(
    path: string,
    requestOptions: RequestOptions = {},
  ): Promise<TResponse> {
    assertConfigured(config);

    if (typeof fetchImpl !== "function") {
      throw new ApiNetworkError("No fetch implementation is available in this runtime.");
    }

    const timeoutMs = requestOptions.timeoutMs ?? defaultTimeoutMs;
    const timeoutController = new AbortController();
    const timer = setTimeout(() => {
      timeoutController.abort(new ApiTimeoutError(`Request to ${path} timed out.`, timeoutMs));
    }, timeoutMs);

    const signals: AbortSignal[] = [timeoutController.signal];
    if (requestOptions.signal) {
      signals.push(requestOptions.signal);
    }

    const headers: Record<string, string> = { Accept: "application/json", ...requestOptions.headers };
    let payload: string | undefined;
    if (requestOptions.body !== undefined) {
      headers["Content-Type"] = "application/json";
      payload = JSON.stringify(requestOptions.body);
    }

    let response: Response;
    try {
      response = await fetchImpl(joinUrl(config.backendBaseUrl, path) + buildQueryString(requestOptions.query), {
        method: requestOptions.method ?? "GET",
        headers,
        ...(payload !== undefined ? { body: payload } : {}),
        signal: combineSignals(signals),
      });
    } catch (cause) {
      if (cause instanceof ApiTimeoutError) {
        throw cause;
      }
      if (requestOptions.signal?.aborted) {
        throw new ApiNetworkError(`Request to ${path} was aborted by the caller.`, cause);
      }
      if (isAbortLike(cause)) {
        throw new ApiTimeoutError(`Request to ${path} timed out.`, timeoutMs);
      }
      throw new ApiNetworkError(`Request to ${path} failed before a response was received.`, cause);
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      throw await toHttpError(response);
    }

    if (response.status === 204) {
      return undefined as TResponse;
    }

    try {
      return (await response.json()) as TResponse;
    } catch (cause) {
      throw new MalformedResponseError(
        `Response from ${path} could not be parsed as JSON.`,
        { status: response.status, cause },
      );
    }
  }

  return {
    request,
    describe: () => ({
      configured: Boolean(config?.backendBaseUrl),
      backendBaseUrl: config?.backendBaseUrl ?? null,
      timeoutMs: defaultTimeoutMs,
    }),
  };
}

function isAbortLike(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    "name" in value &&
    (value as { name?: unknown }).name === "AbortError"
  );
}

export type { ApiErrorKind };
