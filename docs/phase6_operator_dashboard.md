# AIMBULENCE — Phase 6: Operator Dashboard & Backend Integration

**Project:** AIMBULENCE — AI Emergency Hospital Operations Runbook Executor  
**Branch:** `member-1`  
**Phase:** 6 — Operator Dashboard & Full Integration  
**Status:** Completed & Verified  

---

## 1. Overview & Architecture

Phase 6 connects the complete AIMBULENCE operational backend and TrueForge governance harness to an operator-facing web console built on Next.js 15, React 19, TypeScript, and Tailwind CSS.

### System Architecture Flow

```
┌────────────────────────────────────────────────────────┐
│                   Next.js Web UI                       │
│  - SystemStatus & Connection Alert                     │
│  - IncidentOverview (Intake & Live Incidents)          │
│  - DeficitPanel (Bottleneck Analysis)                  │
│  - RunbookSection (15-step Visualizer & States)        │
│  - ApprovalCheckpointModal (7 Mandatory Categories)    │
│  - CapacityOverview & ResourceOverview                 │
│  - AuditActivityPanel (Disk-Verified Events)           │
└──────────────────────────┬─────────────────────────────┘
                           │ (Server Actions & Typed API Client)
                           ▼
┌────────────────────────────────────────────────────────┐
│               FastAPI Operational Backend              │
│  - GET  /api/health                                    │
│  - GET  /api/hospital/status                           │
│  - GET  /api/resources                                 │
│  - POST /api/incidents                                 │
│  - GET  /api/audit-log                                 │
│  - POST /api/runbooks/mci/start                        │
│  - GET  /api/runbooks/{id} & /api/runbooks/latest      │
│  - POST /api/approval/decide                           │
│  - POST /api/runbooks/{id}/resume                      │
└──────────────────────────┬─────────────────────────────┘
                           │
             ┌─────────────┴─────────────┐
             ▼                           ▼
┌─────────────────────────┐ ┌─────────────────────────┐
│     TrueForge Engine    │ │   Operational Tools     │
│  - Single-Use Tokens    │ │  - Hospital Tools       │
│  - Red Action Gate      │ │  - Resource Tools       │
│  - Deterministic Pause  │ │  - Verification Tools   │
└────────────┬────────────┘ └────────────┬────────────┘
             │                           │
             └─────────────┬─────────────┘
                           ▼
┌────────────────────────────────────────────────────────┐
│             Persistent SQLite Database                 │
│  - Hospitals, Beds, ORs, Staff, Ambulances             │
│  - Incidents & Operational Tasks                       │
│  - Runbook Execution & Step Execution Records          │
│  - Append-Only Audit Trail                             │
└────────────────────────────────────────────────────────┘
```

---

## 2. Core Dashboard Components

### 2.1 Top System Status & Connection Alert
- **SystemStatus:** Displays application branding, connected backend environment, database connectivity, and timestamp.
- **ConnectionStateAlert:** Dynamically tracks backend connection states (`CONNECTED`, `DEGRADED`, `DISCONNECTED`). If any backend endpoint fails, partial failure is isolated without taking down unaffected panels.

### 2.2 Incident Intake & Overview
- Displays tracked mass casualty incidents from `GET /api/incidents`.
- Provides an **"Report Documented MCI-01 Alert"** button that dispatches a 42-casualty Highway collision incident directly to the SQLite backend.

### 2.3 Operational Deficit Analysis
- Deterministically calculates deficits for incoming mass casualty casualties without fabricating estimates.
- Flags bed deficits, staffing requirements, and operating room shortages.

### 2.4 MCI-01 15-Step Runbook Visualizer
- Visualizes all 15 operational steps of `MCI-01` with safety tier badges (`GREEN`, `YELLOW`, `RED`).
- Dynamically highlights active step state:
  - `PENDING` (gray)
  - `RUNNING` (sky)
  - `WAITING_APPROVAL` (pulsing red)
  - `COMPLETED` (emerald)
  - `BLOCKED` (rose)
- Shows prominent red alert when TrueForge halts execution at Step 10:
  **"AGENT PAUSED — WAITING FOR HUMAN AUTHORIZATION"**.

### 2.5 TrueForge Human-in-the-Loop Checkpoint Modal
Renders the **7 mandatory approval categories** grounded strictly in real backend contract fields:
1. **Target Action:** `PREEMPT_OPERATING_ROOM`
2. **Operational Rationale:** Deficit of 2 operating rooms for 42 incoming casualties
3. **Projected Impact:** Postponement of elective arthroscopic knee debridement in `OR-3`
4. **Affected Resources:** `OR-3`
5. **Current State:** `status: IN_USE | scheduled procedure: Elective Arthroscopic Knee Debridement`
6. **Proposed State:** `status: RESERVED_FOR_TRAUMA | is emergency cleared: true`
7. **Gate State:** `AGENT PAUSED — WAITING FOR HUMAN AUTHORIZATION`

**Safety Controls:**
- Operator Name input (mandatory, min 2 characters)
- Operator Justification note (mandatory)
- Dedicated `AUTHORIZE (APPROVE)` button
- Dedicated `REJECT / BLOCK` button
- Duplicate-click protection with in-flight loading indicators
- `MODIFY` disabled with explicit *"NOT SUPPORTED BY CONTRACT"* badge

### 2.6 Capacity & Resource Inventory
- Real-time beds, operating rooms, medical staff, ambulances, and blood inventory.
- Real-time status tags for operating rooms (`OPEN`, `IN_USE`, `RESERVED_FOR_TRAUMA`).

### 2.7 Audit Activity Trail
- Live feed of audit records from `GET /api/audit-log`.
- Distinguishes standard `SUCCESS` actions from independent disk-verified actions (`VERIFIED`).

---

## 3. State Persistence & Browser Refresh Recovery

The frontend maintains zero local synthetic mocks: SQLite is the authoritative source of truth.
1. When `loadConsoleData()` renders during SSR, it queries `GET /api/runbooks/latest`.
2. If an active runbook exists in `WAITING_FOR_APPROVAL`, the server populates `execution` and fetches the associated checkpoint.
3. If an operator refreshes their browser while the agent is paused at Step 10, the dashboard reloads in the identical paused state with the red alert and checkpoint review button active.
4. After approval and resume, browser refresh shows the completed 15-step execution with `OR-3` verified on disk.

---

## 4. End-to-End Operator Demo Walkthrough

### Prerequisites
Ensure backend and frontend dependencies are installed.

```powershell
# 1. Start FastAPI Backend (Terminal 1)
.venv\Scripts\python.exe -m uvicorn backend.app.main:app --port 8000

# 2. Start Next.js Frontend (Terminal 2)
cd frontend
npm run dev -- --port 3000
```

Open browser at `http://localhost:3000`.

### Demonstration Workflow

#### Step 1: Initial Operational State
- Observe the dashboard displaying `NORMAL` operational code.
- Notice `OR-3` status is `IN_USE` (Elective Knee Surgery).
- Runbook section shows `NOT CONNECTED / WAITING FOR EXECUTION ENGINE`.

#### Step 2: Trigger Emergency Runbook
- Click **"Initiate MCI-01"** in the Runbook Execution panel.
- The backend engine initiates execution, running Steps 1 through 9:
  - Step 1: Triage Assessment (GREEN)
  - Step 2: Declare Operational Code Orange (YELLOW)
  - Step 3: Assess Emergency Bed Capacity (GREEN)
  - Step 4: Assess Trauma Staffing (GREEN)
  - Step 5: Create Incident Command Task (GREEN)
  - Step 6: Query Available Operating Rooms (GREEN)
  - Step 7: Stage Emergency Resources (YELLOW)
  - Step 8: Dispatch Transport Fleet (YELLOW)
  - Step 9: Re-verify Available Surgical Capacity (GREEN)
- Agent halts at **Step 10 (MCI-01-10)**: Consequential Action preemption of `OR-3`.

#### Step 3: Observe TrueForge Paused Gate
- The runbook status badge pulses red: `WAITING_FOR_APPROVAL`.
- A prominent alert appears: **"AGENT PAUSED — WAITING FOR HUMAN AUTHORIZATION"**.
- Steps 1–9 show `COMPLETED` (green). Step 10 shows `WAITING_APPROVAL` (red).

#### Step 4: Review Approval Proposal
- Click **"Review & Authorize Checkpoint"**.
- The TrueForge Checkpoint Modal opens.
- Inspect the 7 categories:
  - Action: `PREEMPT_OPERATING_ROOM`
  - Rationale: Deficit of 2 trauma ORs
  - Consequence: Postponing elective knee procedure in `OR-3`
  - Current: `IN_USE` ➔ Proposed: `RESERVED_FOR_TRAUMA`

#### Step 5: Authorize Consequential Action
- Enter Operator Name: `Dr. Eleanor Vance, Trauma Medical Director`.
- Enter Justification: `Elective case stable; cleared for emergency trauma surge`.
- Click **"Authorize Consequential Action"**.
- TrueForge single-use token executes:
  1. `OR-3` status is mutated in SQLite to `RESERVED_FOR_TRAUMA`.
  2. Independent disk verification confirms the state change.
  3. Single-use token is consumed and invalidated against replay.
  4. Runbook engine resumes automatically.
  5. Steps 11 through 15 execute:
     - Step 11: Execute OR Preemption & Clear Suite (RED)
     - Step 12: Page On-Call Trauma Surgical Teams (GREEN)
     - Step 13: Reserve O-Negative Blood Units (YELLOW)
     - Step 14: Verify Bed & OR Readiness on Disk (GREEN)
     - Step 15: Publish MCI Operational Readiness Report (GREEN)
- Runbook finishes in `COMPLETED` state.
- Notice `OR-3` in Resource Overview is now `RESERVED_FOR_TRAUMA` (`CLEARED FOR TRAUMA`).
- Notice Audit Log records `SURGE_INTERVENTION_AUTHORIZED` with `VERIFIED` status.

#### Step 6: Test Rejection Path (Alternative)
- When starting another runbook or restarting, click **"Reject / Block Consequential Action"** in the modal.
- TrueForge records human denial with operator notes.
- Runbook engine transitions to `BLOCKED`.
- `OR-3` remains completely untouched in SQLite (`IN_USE`).
- Audit trail logs the denial and safety halt.

---

## 5. Verification & Test Summary

| Test Suite | Tests | Status |
|---|---|---|
| **Backend Test Suite (Pytest)** | 42 | **42 / 42 PASSED** |
| **Frontend Test Suite (Vitest)** | 142 | **142 / 142 PASSED** |
| **Next.js Production Build** | Static & Dynamic Routes | **COMPILED & VERIFIED** |
