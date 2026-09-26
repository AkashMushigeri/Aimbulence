/**
 * Typed frontend error hierarchy for transport failures.
 *
 * `instruction.md` section 15 forbids silently swallowing exceptions, so every
 * failure path in `src/services/` raises one of these rather than returning a
 * bare `undefined` or an empty catch block.
 */

export type ApiErrorKind =
  | "CONFIGURATION"
  | "TIMEOUT"
  | "NETWORK"
  | "HTTP"
  | "VALIDATION"
  | "MALFORMED_RESPONSE"
  | "ABORTED";

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;
  readonly details?: unknown;
  override readonly cause?: unknown;

  constructor(
    kind: ApiErrorKind,
    message: string,
    options: { status?: number; details?: unknown; cause?: unknown } = {},
  ) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.status = options.status;
    this.details = options.details;
    this.cause = options.cause;
  }
}

/** Raised when the backend base URL is absent or unusable. */
export class ApiConfigurationError extends ApiError {
  constructor(message: string, details?: unknown) {
    super("CONFIGURATION", message, { details });
    this.name = "ApiConfigurationError";
  }
}

export class ApiTimeoutError extends ApiError {
  constructor(message: string, timeoutMs: number) {
    super("TIMEOUT", message, { details: { timeoutMs } });
    this.name = "ApiTimeoutError";
  }
}

export class ApiNetworkError extends ApiError {
  constructor(message: string, cause?: unknown) {
    super("NETWORK", message, { cause });
    this.name = "ApiNetworkError";
  }
}

export class ApiHttpError extends ApiError {
  constructor(status: number, message: string, details?: unknown) {
    super("HTTP", message, { status, details });
    this.name = "ApiHttpError";
  }
}

export class ApiValidationError extends ApiError {
  readonly fieldErrors: readonly { field: string; message: string; type: string }[];

  constructor(message: string, fieldErrors: readonly { field: string; message: string; type: string }[] = []) {
    super("VALIDATION", message, { status: 422, details: { fieldErrors } });
    this.name = "ApiValidationError";
    this.fieldErrors = fieldErrors;
  }
}

/** Raised when a 2xx response body does not match the expected contract. */
export class MalformedResponseError extends ApiError {
  constructor(message: string, details?: unknown) {
    super("MALFORMED_RESPONSE", message, { details });
    this.name = "MalformedResponseError";
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}
