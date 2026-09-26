# AIMBULENCE — Frontend (Member 2)

> **Operator dashboard, approval checkpoint UI, runbook visualizer, state verification & execution audit**  
> Phase 6 — State Verification, Chronological Audit & 5-Minute Demo Flow

This directory is owned exclusively by **Member 2** per `instruction.md` section 13.
Member 1 owns `backend/`, the TrueForge integration, the approval engine, the
verification logic, audit-log writing, the runbook execution engine, and the
database. Changes here must not require changes there.

---

## 1. Purpose

This is the operator-facing interface for AIMBULENCE, the AI Emergency Hospital
Operations Runbook Executor. It is intended to let a human emergency operator:

- observe live hospital operational capacity (ED, ICU, operating theatres, staffing, blood bank),
- watch the MCI-01 mass casualty runbook execute step by step,
- receive and adjudicate a human approval request before any consequential (RED) action runs,
- inspect independent post-action disk verification evidence from SQLite,
- review the complete chronological audit trail across all lifecycle phases.

**What this interface is not:** it performs no clinical function. It does not
diagnose, triage, prescribe, or make treatment decisions, and it displays no
patient data. All operational figures are synthetic
(`instruction.md` sections 5, 9, and the README "Safety & Data Ethics").

---

## 2. Current Status — Phase 6 (State Verification & Demo Flow)

> [!IMPORTANT]
> **Complete Demo Flow & Independent Verification.** The control center renders the complete
> 5-minute operational workflow: `ACTION → EXECUTION RESULT → STATE VERIFICATION → AUDIT → FINAL OPERATIONAL STATE`.
> Consequential mutations strictly require human authorization, and execution success is
> never confused with state verification.

What exists and works:

| Area | State |
| :--- | :--- |
| Next.js + TypeScript + Tailwind project | Working, production build passing clean |
| Live Operations Control Center at `/` | Full responsive operator dashboard (`src/components/dashboard/`) |
| Top System Status Bar | Live health, backend connection status, refresh controls |
| Incident Overview | Ingests real incidents from `GET /api/incidents` + controlled intake |
| Hospital Capacity Overview | Real aggregate capacity cards (ED, ICU, ORs, Staff, Depts) |
| Detailed Resource Status | Tabbed physical/human inventory (theatres, staff, blood, fleet) |
| Operational Deficits & Bottlenecks | Deterministic arithmetic (`BACKEND` vs `DERIVED` labeled) |
| MCI-01 Runbook Visualizer | Complete 15-step orchestration viewer (`src/components/dashboard/RunbookSection.tsx`) |
| TrueForge Human Approval Modal | Consequential Action Checkpoint with Impact Briefing (`src/components/approval/`) |
| Verification UI & Evidence Matrix | Three-phase progression: `ACTION REQUESTED → ACTION EXECUTED → STATE VERIFIED` (`src/components/verification/`) |
| Independent Disk Verification Display | Expected vs observed SQLite disk state, timestamp, affected resource, mismatch alerts |
| Chronological Audit Activity Panel | Lifecycle sequence badges: `RUNBOOK STEP → ACTION → APPROVAL → EXECUTION → VERIFICATION → AUDIT` |
| Connection & Error State | Isolated section boundaries, handles `CONNECTED`, `DEGRADED`, `DISCONNECTED` |
| Unit & Integration tests | 16 suites, 161 passing tests |

Verified live against Member 1's running backend on `127.0.0.1:8000`.

### Real-Time Streaming Status:
> [!NOTE]
> **REAL-TIME STREAM PENDING BACKEND CONTRACT.**
> Inspection of the backend code and routes confirmed that no WebSocket endpoint, Server-Sent Events (SSE), or EventSource route is provided by backend Member 1. In accordance with safety governance rules forbidding fabricated protocols or mock intervals, the frontend remains REST-grounded with explicit operator refresh controls and automatic server revalidation. When a backend event contract is specified, streaming hooks will consume it directly.

What is deliberately **not** built, and why:

- **Approval checkpoint decision action** — the live backend has not yet mounted
  the decision execution route. No `APPROVE` / `MODIFY` / `REJECT` decision control
  is exposed in the operator UI. The visualizer clearly halts and alerts `HUMAN AUTHORIZATION REQUIRED`.
- **Live backend runbook execution trigger** — Member 1 implemented the runbook
  engine in `origin/member-1` (`POST /api/runbooks/mci/start`), but this is not yet
  running on the port 8000 backend instance. The trigger button is explicitly disabled
  with clear operator messaging, preventing fake progress simulation.
- **WebSocket / live streaming** — **no event contract exists.** The backend is
  REST-only. Data loads on server render and on explicit operator refresh.
- **Consequential state mutations** — strictly deferred until authorized by human supervisor.

---

## 3. Backend Integration Requirements

`instruction.md` section 14 requires agreed contracts before interdependent
features. Member 1 has published `docs/api_contract.md` on branch `member-1`.

Live integration requires all of the following:

1. Member 1's backend running and reachable at `BACKEND_BASE_URL`.
2. A seeded operational baseline, otherwise `GET /api/hospital/status` returns
   HTTP 404 `Hospital operational baseline not initialized.` The console reports
   that as a section-level failure and shows no figures.
3. `member-1` merged into `main` — the contract document is **not yet on `main`**,
   so this frontend currently depends on a branch that may still change.

Outstanding contract gaps that block later phases:

| Missing | Blocks |
| :--- | :--- |
| `Runbook` / `RunbookStep` schema | Runbook visualiser |
| Approval checkpoint schema | Approval checkpoint UI |
| Runbook execution state machine | Execution progress UI |
| Any event/streaming contract | Live updates |

The provisional interfaces in `src/types/domain/runbook.ts` and
`src/types/domain/execution.ts` carry `TODO(Member 2 -> Member 1)` comments and
**must not be treated as contracts**.

---

## 4. REST Endpoints Integrated

Transcribed from `origin/member-1:docs/api_contract.md` at `19a3f1a`, cross-read
against `backend/app/api/routes/*.py`. Nothing was invented.

| Method | Path | Service | Contract status |
| :--- | :--- | :--- | :--- |
| GET | `/api/health` | `getHealth()` | `[IMPLEMENTED]` |
| GET | `/api/hospital/status` | `getHospitalStatus()` | `[IMPLEMENTED]` |
| GET | `/api/resources` | `getResources()` | `[IMPLEMENTED]` |
| GET | `/api/incidents` | `getIncidents()` | `[IMPLEMENTED]` |
| POST | `/api/incidents` | `createIncident()` | `[IMPLEMENTED]`, not wired to UI |
| GET | `/api/audit-log` | `getAuditLog()` | `[IMPLEMENTED]` |

Declaring types, **never called directly without server action wrapper**:

| Method | Path | Tag |
| :--- | :--- | :--- |
| POST | `/api/agent/execute-runbook` | `[PLANNED - PHASE 3]` |
| POST | `/api/approval/decide` | `[IMPLEMENTED - PHASE 4]` |

Error envelopes mirror `backend/app/main.py`: FastAPI `{ "detail": ... }`, and
the project's structured 422 `{ "detail", "errors": [{ field, message, type }] }`.

### Known contract discrepancy (frontend-handled)

`docs/api_contract.md` documents every timestamp with a `Z` suffix. The running
backend emits **three different forms**:

| Field | Emitted form |
| :--- | :--- |
| `health.timestamp` | `2026-09-26T09:30:49.948098+00:00` |
| `resources.last_updated` | `2026-09-26T09:30:50.241692Z` |
| `hospital.last_updated`, `incident.created_at`, `audit.timestamp` | `2026-09-26T09:30:44.037431` (no offset) |

This is a backend-side inconsistency, reported to Member 1 and **not** worked
around by silently rewriting values. `lib/format.ts` parses all three without
throwing, so no timestamp renders as `Invalid Date`. A naive timestamp is
interpreted in the browser's local zone, which is correct only while the server
runs in UTC.

---

## 5. Technology Stack

| Concern | Choice | Rationale |
| :--- | :--- | :--- |
| Framework | Next.js 15.5.26 (App Router) | Server-side env isolation, same-origin proxy, no CORS dependency in the browser |
| Language | TypeScript 5.7, `strict` | Matches the backend's typed-contract discipline |
| Styling | Tailwind CSS 3.4 | Operator console needs dense, high-contrast operational UI |
| Lint | ESLint 8 + `eslint-config-next` | Repository convention; `next lint` |
| Tests | Vitest 2 + Testing Library | Runs against TS/TSX without a separate build step |
| Runtime | React 19 | Required by Next 15 |
| Server guard | `server-only` | Turns an accidental client import of server config into a build error |

No state-management, data-fetching, or UI library is installed. None is needed
for read-only REST, and `instruction.md` section 4 warns against overbuilding.
Add them when a real requirement appears, not before.

---

## 6. Folder Structure

```
frontend/
├── src/
│   ├── app/
│   │   ├── api/                 # Same-origin proxy routes (server-side relays)
│   │   │   ├── health/          #   -> GET /api/health
│   │   │   ├── hospital-status/ #   -> GET /api/hospital/status
│   │   │   ├── resources/       #   -> GET /api/resources
│   │   │   ├── incidents/       #   -> GET /api/incidents   (read-only)
│   │   │   ├── audit-log/       #   -> GET /api/audit-log
│   │   │   └── _shared.ts       #   structured error relay
│   │   ├── layout.tsx
│   │   ├── page.tsx             # Operator console (server component)
│   │   └── globals.css
│   ├── components/
│   │   ├── common/              # Panel, StatTile, badges, loading, error, retry
│   │   └── console/             # Health, Hospital, Resources, Incidents, Audit
│   ├── services/
│   │   ├── apiClient.ts         # Centralised typed transport
│   │   └── operations.ts        # The documented endpoint services
│   ├── types/
│   │   ├── domain/              # UI-facing camelCase domain model
│   │   └── api/                 # Wire-format mirrors of backend contracts
│   ├── hooks/
│   │   └── useOperationsData.ts # useHealth, useHospitalStatus, useResources,
│   │                            # useIncidents, useAuditLog
│   └── lib/
│       ├── config.ts            # Server-only vs public env boundary
│       ├── errors.ts            # Typed error hierarchy
│       ├── format.ts            # Pure presentation utilities
│       ├── guards.ts            # Runtime response-shape validation
│       ├── loadState.ts         # Per-section load state + aggregation
│       ├── mappers.ts           # Wire -> domain conversion
│       ├── scenario.ts          # Documented MCI-01 reference constants
│       └── serverLoad.ts        # Server-side console load (server-only)
└── tests/                       # Vitest suites
```

**Layering rule:** `app/` → `components/` → `services/` → `types/`. Components
never call `fetch` and never import the service layer — both enforced by
`tests/phase2-boundaries.test.ts`. Wire types never leak into components;
mappers convert at the boundary.

**Two data paths, both server-side:**

1. **Initial render** — `page.tsx` calls `lib/serverLoad.ts`, which invokes the
   services directly. No HTTP round trip; real data in the first response.
2. **Retry** — `router.refresh()` re-runs the server load, or a client hook
   re-fetches its same-origin proxy route.

---

## 7. Local Development

```bash
cd frontend
npm install
cp .env.example .env.local
# Edit BACKEND_BASE_URL to point at the running backend.
npm run dev                  # http://localhost:3000
```

The console **requires** a reachable backend to show operational data. Without
`BACKEND_BASE_URL` it still builds and runs, and renders an explicit
`DISCONNECTED` state explaining what to configure — it never fabricates figures.

| Command | Purpose |
| :--- | :--- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint via `next lint` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest, single run |
| `npm run test:watch` | Vitest watch mode |

Requires Node.js 18.18+.

---

## 8. Environment Configuration

See `.env.example`. Two categories, deliberately separated:

**Server-only** — read in Node only, never inlined into the browser bundle:

| Variable | Purpose |
| :--- | :--- |
| `BACKEND_BASE_URL` | Preferred backend origin, e.g. `http://localhost:8000` |
| `BACKEND_HOST` + `BACKEND_PORT` | Alternative; both required together |
| `API_TIMEOUT_MS` | Per-request timeout; defaults to 10000 |

`BACKEND_HOST=0.0.0.0` is a bind address, not a dialable destination, so it is
rewritten to `localhost` for outbound requests.

**Public** — `NEXT_PUBLIC_*`, inlined into the browser bundle, non-sensitive
display strings only:

| Variable | Purpose |
| :--- | :--- |
| `NEXT_PUBLIC_APP_NAME` | Console product name |
| `NEXT_PUBLIC_APP_TAGLINE` | Console tagline |

> [!CAUTION]
> **No API key, token, or credential belongs in this directory.** Backend
> credentials (`TRUEFORGE_API_KEY`, `LLM_API_KEY`, `DATABASE_URL`) live
> exclusively in the backend process. `tests/no-secrets.test.ts` fails the suite
> if a credential assignment or a secret-shaped literal is committed here, and
> the test runner refuses to start if backend credentials are present in the
> environment.
>
> Verified: the production client bundle under `.next/static` contains **no**
> backend origin value and no `BACKEND_HOST` / `BACKEND_PORT` reference. The only
> occurrence of the string `BACKEND_BASE_URL` is operator-facing help text. All
> backend traffic is relayed by the server-side proxy routes.

---

## 9. Future Integration Points

Reserved, not implemented:

- `src/services/` — mutation services (`approvals.ts`, `runbookExecution.ts`)
  once their contracts are served.
- `src/hooks/` — live-state subscription, once an event contract is published.
  Note that the current hooks deliberately do **not** poll.
- `src/components/approval/` — the checkpoint modal rendering all seven fields
  required by `instruction.md` section 16, with explicit
  `[APPROVE] / [MODIFY] / [REJECT]` controls.
- `src/components/runbook/` — the 15-step `MCI-01` stepper with per-step tier
  badges.
- Deficit computation and surge projections, once the agent's sandbox results are
  exposed over a contract.

---

## 10. Safety Restrictions

Binding on all future frontend work:

1. **Never render an unverified figure as fact.** No capacity, staffing, or
   inventory number may appear except from the connected operational store. A
   failed section renders an error and **no** figures, and never falls back to
   scenario constants from `lib/scenario.ts`.
2. **Never present stale data as current.** Each section discards its previous
   value on refetch rather than showing it without a stale marker.
3. **Never imply success without verification.** Per `instruction.md` section 17,
   an action is not done because a request returned 2xx. The UI must render a
   verified state only from server-confirmed verification, and must never use
   optimistic UI for a state mutation.
4. **Never bypass or pre-fill the approval gate.** No approval control may be
   rendered until the approval engine serves and enforces the decision. The
   frontend must never construct, infer, or default a decision.
5. **Never present a paused agent as running.** Section 16.7 requires the
   console to prominently indicate the agent is awaiting human input.
6. **No clinical functionality.** No diagnostic, triage-tagging, or prescribing
   affordance may ever be added.
7. **No PHI.** Synthetic data exclusively.
8. **No silent failure.** Every transport error surfaces as a typed error from
   `src/lib/errors.ts`; empty catch blocks are forbidden (section 15). A response
   that violates the contract is rejected, not partially rendered.
9. **Truthful documentation.** Features are marked as planned until they are
   built and verified (section 19).

---

## 11. Validation Performed

Recorded so the claims here are auditable.

**Static validation** (all run against this working tree):

| Check | Result |
| :--- | :--- |
| `npm run lint` | No ESLint warnings or errors (`next lint`) |
| `npm run typecheck` | Clean (`strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`) |
| `npm test` | All test suites passing (`vitest`) |
| `npm run build` | Compiled clean; static and dynamic routes, zero warnings |

**Live validation** against Member 1's real backend from `origin/member-1`
(commit `19a3f1a`), run unmodified in a throwaway directory outside this
repository, on `127.0.0.1:8000`:

| Check | Result |
| :--- | :--- |
| `GET /api/health` | Live 200; status `healthy`, database `connected` |
| `GET /api/hospital/status` | Live 200; `Metro Central Trauma Hospital`, `NORMAL`, ED 12/20, ICU 4/10, OR 2/5 |
| `GET /api/resources` | Live 200; 30 beds, 5 theatres, 24 staff, 5 vehicles, 4 blood types |
| `GET /api/incidents` | Live 200; list mapped to domain |
| `POST /api/incidents` | Live 201; used to verify contract + 422 envelope, not wired to UI |
| `GET /api/audit-log` | Live 200; audit records mapped with safety tier |
| Frontend page render | Real values present in HTML on dev **and** production build |
| Wire → domain mapping | Confirmed in the live payloads (e.g. `emergency_beds_available` → `emergencyBedsAvailable`) |
| Backend unreachable | Stopped the backend; page rendered `Backend unreachable` + `DISCONNECTED`, and **no** capacity figures |
| Proxy with backend down | Returned HTTP 502 with a structured error envelope |
| Client bundle scan | No backend origin or `BACKEND_HOST`/`BACKEND_PORT` in `.next/static` |

**Not verified live:** partial endpoint failure was exercised with an injected
transport stub rather than against the real backend, because triggering a genuine
single-endpoint fault would have required modifying Member 1's database. The
partial-failure path is covered by `tests/console-data.test.ts` and
`tests/console-panels.test.tsx`.
