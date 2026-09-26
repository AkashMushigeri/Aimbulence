/**
 * Runtime shape guards for API responses.
 *
 * Phase 1 relied on TypeScript types alone, which provide no protection at
 * runtime against a backend response that does not match the contract. These
 * guards convert a malformed payload into a typed `MalformedResponseError`
 * rather than a `TypeError` deep inside a mapper, or worse, a silently
 * half-populated domain object.
 *
 * `instruction.md` section 15 forbids silently swallowing failures, and
 * section 19 forbids presenting unwritten or unverified state as working.
 */
import { MalformedResponseError } from "@/lib/errors";

function fail(path: string, expected: string, actual: unknown): never {
  throw new MalformedResponseError(
    `Backend response does not match the documented contract: expected ${expected} at "${path}".`,
    { path, expected, receivedType: actual === null ? "null" : typeof actual },
  );
}

/**
 * Assert the payload is a JSON object, returning it as `T`.
 *
 * `T` is the declared transport type. This guard only verifies the container is
 * an object; per-field verification is performed by the mappers' `required()`
 * checks, which raise on any null or missing contract field.
 */
export function assertObject<T>(value: unknown, path = "response"): T {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail(path, "an object", value);
  }
  return value as T;
}

export function assertArray<T>(value: unknown, path = "response"): T[] {
  if (!Array.isArray(value)) {
    fail(path, "an array", value);
  }
  return value as T[];
}

export function assertString(value: unknown, path: string): string {
  if (typeof value !== "string") {
    fail(path, "a string", value);
  }
  return value;
}

export function assertNumber(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    fail(path, "a finite number", value);
  }
  return value;
}

export function assertBoolean(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") {
    fail(path, "a boolean", value);
  }
  return value;
}

/**
 * Run a mapper, re-labelling any contract-violation `TypeError` raised while
 * reading the payload as a `MalformedResponseError`. Genuine programming
 * errors still propagate.
 */
export function mapOrThrow<TWire, TDomain>(
  wire: TWire,
  mapper: (value: TWire) => TDomain,
  path: string,
): TDomain {
  try {
    return mapper(wire);
  } catch (cause) {
    if (cause instanceof MalformedResponseError) {
      throw cause;
    }
    if (cause instanceof TypeError) {
      throw new MalformedResponseError(
        `Backend response from ${path} did not match the documented contract.`,
        { path, cause: cause.message },
      );
    }
    throw cause;
  }
}
