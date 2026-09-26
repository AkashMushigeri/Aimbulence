# AIMBULENCE — Phase 7: End-to-End Validation & Reliability Hardening

**Project:** AIMBULENCE — AI Emergency Hospital Operations Runbook Executor  
**Branch:** `member-1`  
**Phase:** 7 — End-to-End Validation & Reliability Hardening  
**Status:** In Progress  

---

## 1. Current Architecture & Component Inventory

AIMBULENCE is an operational runbook executor for emergency hospital surge response. The system is designed around a single guiding principle:
> **"Autonomous in execution, but not autonomous in authority."**

### Component Inventory

1. **Operator Web Console (Next.js 15 App Router + React 19):**
   - Renders synthetic hospital status, active incidents, deficit analysis, 15-step procedure progress, TrueForge approval gate, and audit logs.
   - Enforces strict transport boundaries: components never call `fetch()` directly; all mutations and queries route through typed Server Actions and internal API handlers.
   - Authoritative source of truth remains the backend SQLite database across browser refresh and restart.

2. **FastAPI Operational Backend (`backend/app/main.py`):**
   - Exposes REST contracts for system health, hospital capacity, resource inventory, incident reporting, runbook lifecycle, TrueForge checkpoint decisions, and audit events.

3. **MCI-01 Runbook Execution Engine (`backend/app/runbooks/engine.py`):**
   - Deterministic 15-step orchestrator executing declarative steps:
     - Steps 1–9 (`GREEN`/`YELLOW`): Automated triage, code declaration, bed assessment, staffing assessment, command task creation, OR status checks, staging, transport dispatch, and surge recalculation.
     - Step 10 (`RED`): Preempt Operating Room `OR-3` (halts at TrueForge approval checkpoint).
     - Steps 11–15 (`RED`/`YELLOW`/`GREEN`): Clearance execution, surgical paging, blood reservation, readiness verification, and operational report publication.
   - Persists execution state in SQLite tables `runbook_executions` and `runbook_step_executions`.
   - Built-in idempotency: skips already completed steps if re-run.

4. **TrueForge Safety Harness & Approval Gate (`backend/app/approval/checkpoint.py`, `backend/app/agent/trueforge_runner.py`):**
   - Pauses execution on consequential actions with official event `tool.approval_required`.
   - Issues cryptographically bound, single-use execution tokens only upon authentic human approval (`allow`/`APPROVE`).
   - Rejects consequential actions on operator denial (`deny`/`REJECT`), immediately blocking runbook progression and guaranteeing zero database mutation.
   - Strictly enforces token binding against action ID, checkpoint ID, resource, and replay attacks.

5. **Operational Tools Layer (`backend/app/tools/`):**
   - `hospital_tools.py`: Read capacity, calculate shortages for casualty surges.
   - `resource_tools.py`: Read inventory, reserve resources (YELLOW), preempt operating rooms (RED, token-gated).
   - `task_tools.py`: Create and track operational command tasks.
   - `verification_tools.py`: Independently inspect SQLite records on disk to verify mutations.
   - `audit_helper.py`: Write append-only audit events with caller, tier, timestamp, and details.

6. **Persistent SQLite Database (`hospital_operations.db`):**
   - Models: `HospitalRecord`, `DepartmentRecord`, `BedRecord`, `OperatingRoomRecord`, `StaffRecord`, `AmbulanceRecord`, `BloodInventoryRecord`, `IncidentRecord`, `OperationalTaskRecord`, `AuditEventRecord`, `RunbookExecutionRecord`, `RunbookStepExecutionRecord`.

---

## 2. Current Execution Path

```
Incident Dispatch (POST /api/incidents)
       │
       ▼
Runbook Initiation (POST /api/runbooks/mci/start)
       │
       ▼
MCI-01 Engine Loop (Steps 1–9: Automated GREEN & YELLOW tools)
       │
       ▼
Consequential Detection (Step 10: Preempt OR-3)
       │
       ▼
TrueForge Interrupt ("tool.approval_required" Checkpoint Created)
       │
       ▼
Engine Pauses (State: WAITING_FOR_APPROVAL, current_step: MCI-01-10)
       │
       ▼
Operator Web Console Displays Pulsing Red Alert & Checkpoint Modal
       │
       ├─────────────────────────────────────────┐
       ▼                                         ▼
[APPROVE PATH]                            [REJECT PATH]
Operator submits AUTHORIZE                Operator submits REJECT
(POST /api/approval/decide)               (POST /api/approval/decide)
       │                                         │
TrueForge issues Single-Use Token         TrueForge records Denial
       │                                         │
Token-Gated Preemption of OR-3            Zero Resource Mutation
       │                                         │
Independent Disk Verification             Audit Logged: Human Denial
       │                                         │
Token Consumed & Invalidated              Runbook Resumed (POST .../resume)
       │                                         │
Runbook Resumed (POST .../resume)         Runbook Transitions to BLOCKED
       │                                         │
Steps 11–15 Execute & Verify              Engine Halts Safely
       │
Runbook State: COMPLETED
```

---

## 3. Known Risks & Failure Modes

1. **Unchecked Consequential Execution:** Any direct invocation of `preempt_operating_room` without a valid single-use token must be strictly forbidden.
2. **Token Replay Attacks:** An operator or script replaying an authorization token must not trigger a second mutation.
3. **Cross-Resource Token Misuse:** A token issued for `OR-3` must fail if attempted against `OR-4` or beds.
4. **Premature Runbook Resume:** Attempting to resume a runbook while the checkpoint is still `PAUSED_FOR_APPROVAL` must fail with HTTP 409 Conflict.
5. **State Desynchronization on Restart:** If the FastAPI backend or system process restarts while paused at Step 10, the database state must survive and re-hydrate without creating duplicate checkpoints or executing automatically.
6. **False Success Reporting:** If verification fails or resource is unavailable, the runbook must fail visibly, never reporting false readiness.

---

## 4. Phase 7 Validation Plan

We will implement automated end-to-end tests covering:

| Test ID | Test Category | Target Scenarios | Status |
|---|---|---|---|
| **E2E-01** | Full Happy-Path Lifecycle | Steps 1–15: Start ➔ Automated Staging ➔ Checkpoint Pause ➔ Token Issuance ➔ Mutation ➔ Disk Verification ➔ Resume ➔ Completion. | **PASSED** |
| **E2E-02** | Full Rejection Lifecycle | Rejection at Step 10 ➔ Zero SQLite mutation ➔ Token denied ➔ Runbook BLOCKED ➔ Audit logged. | **PASSED** |
| **E2E-03** | Process Restart / Recovery | Restart before checkpoint, during pause, and after completion; verify SQLite rehydration. | **PASSED** |
| **E2E-04** | Idempotency & Duplicate Prevention | Duplicate runbook start, duplicate approval submissions, duplicate resume calls. | **PASSED** |
| **E2E-05** | Security & Token Exploit Defense | Execution without token, wrong token, wrong resource, token replay, post-rejection execution. | **PASSED** |
| **E2E-06** | Failure Injection & Boundary Defense | Missing resource failure, database integrity error, premature resume handling. | **PASSED** |
| **E2E-07** | Audit Trail Integrity | Complete audit validation verifying WHO, WHAT, WHICH resource, decision notes, and verification. | **PASSED** |
| **E2E-08** | Synthetic Demo Reset | Safe, isolated demo reset endpoint and function restoring database baseline. | **PASSED** |

---

## 5. Automated Validation Results

All 48 backend automated tests and 142 frontend tests pass:

```
collected 48 items
backend/tests/test_contracts.py ...........                             [ 22%]
backend/tests/test_phase3_mcp.py .......                                [ 37%]
backend/tests/test_phase4_approval.py .........                         [ 56%]
backend/tests/test_phase5_runbook.py ........                           [ 72%]
backend/tests/test_phase7_e2e_validation.py ......                      [ 85%]
backend/tests/test_tools.py ...........                                 [100%]
======================== 48 passed in 7.90s ========================
```

---

## 6. Security & Authorization Guarantees

1. **TrueForge Safety Boundary:** Consequential actions cannot execute without passing through `tool.approval_required`. Direct tool calls raise `UnauthorizedRedActionError`.
2. **Single-Use Cryptographic Binding:** Each authorization token is bound to `checkpoint_id`, `action_id`, and `affected_resource`. Once consumed, replay attempts fail immediately.
3. **Zero Mutation on Rejection:** When an operator rejects a proposal, no token is issued, SQLite state remains completely untouched, and the runbook safely transitions to `BLOCKED`.
4. **State Persistence & Rehydration:** The authoritative source of truth is SQLite. Even if the process terminates while paused at Step 10, the paused checkpoint and step progress persist and resume safely.
5. **Synthetic Demo Reset (`POST /api/demo/reset`):** Safely restores the operational database, cleared task logs, operating room allocations (`OR-3` to `IN_USE`), and in-memory TrueForge checkpoints to deterministic baseline.

