import "@testing-library/jest-dom/vitest";

/**
 * Test environment guard rails.
 *
 * Phase 1 must not be able to silently depend on ambient credentials. Any test
 * that supplies an API key or database credential fails fast rather than
 * exercising a code path that only works when a real secret is present.
 */
const FORBIDDEN_ENV_KEYS = [
  "OPENAI_API_KEY",
  "LLM_API_KEY",
  "TRUEFORGE_API_KEY",
  "DATABASE_URL",
] as const;

for (const key of FORBIDDEN_ENV_KEYS) {
  if (process.env[key]) {
    throw new Error(
      `Refusing to run tests: ${key} is set in the environment. Frontend tests must never run with backend credentials present.`,
    );
  }
}
