import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Secret-exposure guard.
 *
 * No credential may be committed into `frontend/`, and no module may hand a
 * secret to the browser bundle (`instruction.md` section 11).
 */
const FRONTEND_ROOT = resolve(process.cwd());

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".env"]);

const SECRET_NAME_PATTERN =
  /(TRUEFORGE_API_KEY|LLM_API_KEY|OPENAI_API_KEY|ANTHROPIC_API_KEY|DATABASE_URL|API_SECRET|ACCESS_TOKEN)\s*[=:]/;

const VALUE_PATTERNS: readonly { label: string; pattern: RegExp }[] = [
  { label: "OpenAI-style key", pattern: /\bsk-[A-Za-z0-9]{16,}\b/ },
  { label: "GitHub token", pattern: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/ },
  { label: "Google API key", pattern: /\bAIza[0-9A-Za-z_-]{30,}\b/ },
  { label: "Private key block", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
];

function collectFiles(directory: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(directory)) {
    if (entry === "node_modules" || entry === ".next" || entry === "coverage") {
      continue;
    }
    const fullPath = join(directory, entry);
    if (statSync(fullPath).isDirectory()) {
      collectFiles(fullPath, acc);
    } else if (SOURCE_EXTENSIONS.has(extname(fullPath)) || entry === ".env.example") {
      acc.push(fullPath);
    }
  }
  return acc;
}

const files = collectFiles(FRONTEND_ROOT);

const isTestFile = (file: string): boolean =>
  relative(FRONTEND_ROOT, file).replace(/\\/g, "/").startsWith("tests/");

describe("secret hygiene", () => {
  it("scans a non-trivial set of files", () => {
    expect(files.length).toBeGreaterThan(5);
  });

  it("contains no credential assignments in shipped source", () => {
    // Test files are excluded from the name check only: a test that proves a
    // credential is not leaked must name the credential. They are still scanned
    // for literal secret values by the next test.
    const offenders = files.filter(
      (file) => !isTestFile(file) && SECRET_NAME_PATTERN.test(readFileSync(file, "utf8")),
    );

    expect(offenders.map((file) => relative(FRONTEND_ROOT, file))).toEqual([]);
  });

  it("contains no literal secret values", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const contents = readFileSync(file, "utf8");
      for (const { label, pattern } of VALUE_PATTERNS) {
        if (pattern.test(contents)) {
          offenders.push(`${relative(FRONTEND_ROOT, file)} (${label})`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it("ships no local environment file", () => {
    const localEnvFiles = files.filter((file) => {
      const name = relative(FRONTEND_ROOT, file);
      return name === ".env" || name === ".env.local" || name.startsWith(".env.local");
    });

    expect(localEnvFiles).toEqual([]);
  });
});

describe("backend configuration isolation", () => {
  it("keeps the backend origin out of the browser bundle", () => {
    // `src/lib/config.ts` is the only module permitted to read BACKEND_* vars,
    // and it must not be imported by a client component.
    const clientModules = files.filter(
      (file) =>
        (file.endsWith(".tsx") || file.endsWith(".ts")) &&
        readFileSync(file, "utf8").includes('"use client"'),
    );

    for (const file of clientModules) {
      expect(readFileSync(file, "utf8")).not.toMatch(/BACKEND_(HOST|PORT|BASE_URL)/);
    }
  });
});
