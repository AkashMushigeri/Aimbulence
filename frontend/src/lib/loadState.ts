/**
 * Per-endpoint load state.
 *
 * Each documented endpoint settles independently so that one failure is visible
 * as a partial failure rather than collapsing the whole console into a single
 * error, and so a successful endpoint is never reported as failed.
 */
import { ApiError, ApiNetworkError, isApiError } from "@/lib/errors";

export type Loadable<T> =
  | { readonly status: "loading" }
  | { readonly status: "available"; readonly data: T; readonly loadedAt: string }
  | { readonly status: "failed"; readonly error: ApiError };

export const LOADING: Loadable<never> = { status: "loading" };

export function available<T>(data: T, loadedAt: string = new Date().toISOString()): Loadable<T> {
  return { status: "available", data, loadedAt };
}

export function failed(error: ApiError): Loadable<never> {
  return { status: "failed", error };
}

/** Coerce any thrown value into the typed error hierarchy. */
export function toApiError(value: unknown): ApiError {
  if (isApiError(value)) {
    return value;
  }
  return new ApiNetworkError(value instanceof Error ? value.message : "Unknown error.", value);
}

/**
 * Normalise an unknown thrown value into a displayable message without
 * discarding the typed error when one is available.
 */
export function describeError(error: unknown): string {
  if (isApiError(error)) {
    switch (error.kind) {
      case "CONFIGURATION":
        return "Backend is not configured. Set BACKEND_BASE_URL on the server.";
      case "TIMEOUT":
        return "The backend did not respond in time.";
      case "NETWORK":
        return "The backend could not be reached.";
      case "VALIDATION":
        return "The backend rejected the request payload.";
      case "MALFORMED_RESPONSE":
        return "The backend returned a response that does not match the documented contract.";
      case "HTTP":
        return `The backend responded with HTTP ${error.status ?? "?"}. ${error.message}`;
      case "ABORTED":
        return "The request was cancelled.";
    }
  }
  return error instanceof Error ? error.message : "Unknown error.";
}

export interface LoadRequest<T> {
  readonly key: string;
  readonly label: string;
  readonly load: (signal?: AbortSignal) => Promise<T>;
}

export interface SectionState {
  readonly label: string;
  readonly state: Loadable<unknown>;
}

export type SectionStates = Readonly<Record<string, SectionState>>;

/**
 * Settle every section independently, never rejecting.
 *
 * A section that fails is recorded as failed while its siblings still report
 * their real state, which is what makes partial failure visible instead of
 * being masked by a single aggregate error.
 */
export async function loadSections(
  requests: readonly LoadRequest<unknown>[],
): Promise<SectionStates> {
  const settled = await Promise.all(
    requests.map(async (request) => {
      try {
        const data = await request.load();
        return [request.key, { label: request.label, state: available(data) }] as const;
      } catch (error) {
        return [request.key, { label: request.label, state: failed(toApiError(error)) }] as const;
      }
    }),
  );
  return Object.fromEntries(settled);
}

