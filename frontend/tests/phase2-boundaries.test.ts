import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Phase 2 boundary guards.
 *
 * These are static assertions about the source tree. They fail the build if a
 * later change quietly crosses a phase boundary that the backend does not
 * currently support.
 */
const FRONTEND_ROOT = resolve(process.cwd());

function collectFiles(directory: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(directory)) {
    if (["node_modules", ".next", "coverage"].includes(entry)) {
      continue;
    }
    const fullPath = join(directory, entry);
    if (statSync(fullPath).isDirectory()) {
      collectFiles(fullPath, acc);
    } else if ([".ts", ".tsx", ".js", ".jsx"].includes(extname(fullPath))) {
      acc.push(fullPath);
    }
  }
  return acc;
}

const sourceFiles = collectFiles(join(FRONTEND_ROOT, "src"));
const componentFiles = sourceFiles.filter((file) => file.includes(`${join("src", "components")}`));
const serviceFiles = sourceFiles.filter((file) => file.includes(`${join("src", "services")}`));
const appApiFiles = sourceFiles.filter((file) => file.includes(`${join("src", "app", "api")}`));

const read = (file: string): string => readFileSync(file, "utf8");
const rel = (file: string): string => relative(FRONTEND_ROOT, file).replace(/\\/g, "/");

/**
 * Strip comments so that prose describing a *deliberate omission* (for example
 * "execute-runbook is not implemented") is not mistaken for a call to it.
 */
function code(file: string): string {
  return read(file)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/** Strip type-only imports; a type dependency is not a runtime transport dependency. */
function codeWithoutTypeImports(file: string): string {
  return code(file).replace(/import\s+type\s+[^;]+;/g, "");
}

describe("no undocumented backend endpoint is referenced", () => {
  it("never references an undocumented endpoint outside its constant declaration", () => {
    const planned = ["execute-runbook"];

    for (const file of [...serviceFiles, ...componentFiles, ...appApiFiles]) {
      const contents = code(file);
      // The constants module may declare them; nothing else may.
      if (rel(file) === "src/types/api/contracts.ts") {
        continue;
      }
      for (const path of planned) {
        expect(contents, `${rel(file)} references ${path}`).not.toContain(path);
      }
    }
  });

  it("defines backend paths only as documented constants", () => {
    const literalPaths = serviceFiles
      .flatMap((file) => [...code(file).matchAll(/["'`](\/api\/[a-z0-9\-/_]*)["'`]/gi)])
      .map((match) => match[1]);

    expect(literalPaths).toEqual([]);
  });
});

describe("no WebSocket or streaming implementation", () => {
  it("contains no WebSocket, SSE, or event-stream transport", () => {
    for (const file of sourceFiles) {
      const contents = code(file);
      for (const forbidden of ["new WebSocket", "EventSource", "text/event-stream", "onmessage"]) {
        expect(contents, `${rel(file)} contains ${forbidden}`).not.toContain(forbidden);
      }
    }
  });
});

describe("controlled mutation boundaries", () => {
  it("restricts state-mutation endpoint calls to documented operations", () => {
    for (const file of serviceFiles) {
      const contents = code(file);
      const postCalls = [...contents.matchAll(/method:\s*"POST"/g)];
      if (postCalls.length > 0) {
        expect(rel(file)).toBe("src/services/operations.ts");
        expect(contents).toContain("createIncident");
        expect(contents).toContain("decideApproval");
        expect(contents).toContain("startMciRunbook");
        expect(contents).toContain("resumeRunbook");
      }
    }
  });

  it("proxies only documented mutation routes", () => {
    for (const file of appApiFiles.filter((path) => path.endsWith("route.ts"))) {
      const contents = code(file);
      const isMutationRoute =
        file.includes("approval") || file.includes("runbooks") || file.includes("incidents");
      if (!isMutationRoute) {
        for (const verb of ["POST", "DELETE", "PUT", "PATCH"]) {
          expect(contents, `${rel(file)} exports a ${verb} handler`).not.toMatch(
            new RegExp(`export async function ${verb}\\b`),
          );
        }
      }
    }
  });

  it("exposes no approval decision controls in the read-only console panels", () => {
    const consoleFiles = componentFiles.filter((file) =>
      file.includes(`${join("src", "components", "console")}`),
    );
    for (const file of consoleFiles) {
      const contents = code(file);
      for (const forbidden of [
        /onClick[^=]*=[^;]*(approve|reject|modify)/i,
        /["'`](APPROVE|MODIFY|REJECT)["'`]/,
        /submitDecision|sendApproval|decideApproval/i,
      ]) {
        expect(contents, `${rel(file)} exposes an approval control`).not.toMatch(forbidden);
      }
    }
  });
});

describe("components never call fetch directly", () => {
  it("keeps transport out of the component layer", () => {
    for (const file of componentFiles) {
      const contents = codeWithoutTypeImports(file);
      expect(contents, `${rel(file)} calls fetch directly`).not.toMatch(/\bfetch\s*\(/);
      expect(contents, `${rel(file)} imports the API client`).not.toContain("@/services/apiClient");
      expect(contents, `${rel(file)} imports the operations service`).not.toContain(
        "@/services/operations",
      );
    }
  });

  it("restricts backend access to the server-side service layer", () => {
    // Only an actual environment read counts; mentioning the variable in
    // operator-facing copy does not expose it. `apiClient.ts` is intentionally
    // absent: it resolves configuration through `loadServerConfig()` rather
    // than touching `process.env` itself, keeping a single read site.
    const filesReadingBackendConfig = sourceFiles.filter((file) =>
      /process\.env\.[A-Z_]*BACKEND|env\.[A-Z_]*BACKEND/.test(code(file)),
    );

    expect(filesReadingBackendConfig.map(rel).sort()).toEqual(["src/lib/config.ts"]);
  });
});

describe("no secret is exposed to client-side code", () => {
  it("keeps backend configuration out of client components", () => {
    for (const file of componentFiles.filter((path) => read(path).includes('"use client"'))) {
      const contents = code(file);
      expect(contents, `${rel(file)} references backend configuration`).not.toMatch(
        /process\.env\.[A-Z_]*BACKEND/,
      );
      expect(contents, `${rel(file)} references backend configuration`).not.toMatch(
        /process\.env\.(TRUEFORGE|LLM|OPENAI|DATABASE)/,
      );
    }
  });

  it("keeps backend configuration out of the client hook layer", () => {
    for (const file of sourceFiles.filter((path) => path.includes(`${join("src", "hooks")}`))) {
      expect(code(file), `${rel(file)} references backend configuration`).not.toMatch(
        /process\.env\.[A-Z_]*BACKEND/,
      );
    }
  });

  it("marks the server-side loader as server-only", () => {
    expect(read(join(FRONTEND_ROOT, "src", "lib", "serverLoad.ts"))).toContain('"server-only"');
  });
});
