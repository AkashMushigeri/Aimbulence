# AIMBULENCE Development Instructions

> **Operational Guidelines and Engineering Governance for AI Coding Agents and Developers**  
> **Project:** AIMBULENCE — AI Emergency Hospital Operations Runbook Executor  
> **Hackathon:** Agents That Act — TrueFoundry × Polaris / HackCulture  
> **Target Harness:** TrueForge  

---

## 1. Project Goal
AIMBULENCE is an autonomous AI operational runbook executor engineered for hospital emergency command during Mass-Casualty Incidents (MCIs). 

- **Primary Mission:** Rapidly coordinate operational hospital capacity (emergency beds, ICU availability, operating theaters, trauma staff, blood bank supplies) in response to acute casualty surges.
- **Strict Boundary:** AIMBULENCE is **NOT** a medical diagnostic tool, does not prescribe treatments, and does not replace doctors, nurses, or hospital leadership. It executes operational and logistical workflows.

---

## 2. Hackathon Constraints
This project is built for the **Agents That Act** Hackathon:
- **TrueForge is Mandatory:** TrueForge must serve as the primary agent harness, runtime, MCP tool provider, and approval checkpoint mechanism. It must never be replaced with an alternate framework.
- **Real System / Tool Interaction:** The agent must reach a real connected data system or service. A purely mocked in-memory function or fixture returning fake data is unacceptable for the final delivery.
- **Acting, Not Chatting:** The system must demonstrate an autonomous execution loop (read, reason, plan, act, verify, adapt), not merely conversational chat responses.

---

## 3. Build Incrementally
Never attempt to build the entire system in a single broad pass. All engineering must proceed in small, verifiable vertical slices.

**Strict Implementation Sequence:**
```
Phase 0: Documentation & Rules (CURRENT)
   ↓
Phase 1: Foundation (Schemas & Contracts)
   ↓
Phase 2: Real System / Tool Layer (MCP & Operational DB)
   ↓
Phase 3: Agent Harness & Runbook Engine
   ↓
Phase 4: Consequential Action & TrueForge Approval Checkpoint
   ↓
Phase 5: State Verification & Audit Logging
   ↓
Phase 6: End-to-End Demo Hardening
```

---

## 4. Do Not Overbuild
Avoid scope creep. Every technical decision must directly serve the core MVP demo.
- **Scope Limit for v1:**
  - Exactly **ONE** incident scenario: Multi-vehicle mass-casualty collision (42 incoming casualties).
  - Exactly **ONE** runbook: Mass-Casualty Response Runbook (`MCI-01`).
  - Exactly **ONE** real connected operational data system.
  - Exactly **ONE** consequential approval checkpoint (TrueForge Human-in-the-Loop gate).
  - Exactly **ONE** state verification and audit trail loop.
- **Do NOT Build:** Complex multi-department clinical hospital portals, ambulance GPS/GIS routing simulators, machine learning training pipelines, or national health grid integrations.

---

## 5. Medical Safety & Synthetic Data
- **No Clinical Intervention:** Under no circumstances should the agent offer patient diagnosis, medical advice, clinical triage tagging, or pharmaceutical prescriptions.
- **Synthetic Data Only:** Real patient data or Protected Health Information (PHI) must never be loaded into the repository, database, or LLM context. All bed numbers, staff names, incident details, and resource counts must be strictly synthetic.

---

## 6. Agent Authority & Action Classification
The agent operates under a strict principle:

> **"The agent is autonomous in execution, but not autonomous in authority."**

All agent actions belong to one of three safety categories:

1. 🟢 **GREEN (Safe / Automatic Execution):**
   - Read operational database state (bed count, staff status, blood reserves).
   - Perform mathematical shortage and bottleneck computations.
   - Create internal task checklists and operational logs.
   - Stage non-critical resources.
   - Verify action execution.
2. 🟡 **YELLOW (Confirmation):**
   - Reserve auxiliary staging areas.
   - Reassign non-trauma on-call rosters within approved shift policies.
3. 🔴 **RED (Human Approval Required — Checkpoint Gate):**
   - Declare hospital-wide emergency status (e.g., Code Orange / Disaster Activation).
   - Cancel or postpone scheduled elective surgeries.
   - Reallocate ICU recovery beds.
   - Dispatch external mutual-aid calls or divert ambulances.

**Safety Rules:**
- The agent must **STOP** immediately upon reaching any RED action.
- Never bypass the approval checkpoint.
- Never fake approval in code or tests to force progression.
- Never automatically mark a consequential action as approved without an authentic human signal.

---

## 7. Tool Usage Standards
Every tool exposed to the agent must adhere to standard specifications:
- **Defined Interface:** Explicit typed inputs and structured return schemas (Pydantic / JSON Schema).
- **Clear Purpose:** Single responsibility per tool (e.g., `get_hospital_capacity`, `update_bed_status`, `send_internal_alert`).
- **Error Handling:** Graceful error handling returning machine-readable status codes and failure messages.
- **Auditability:** Every tool invocation, parameter payload, and returned response must be emitted to the execution audit log.
- **Permission Boundaries:** Explicit enforcement of GREEN vs. RED classification at the tool invocation level.

---

## 8. Real System Requirement
- The final implementation must interface with an actual operational backend (e.g., a real relational database like SQLite/PostgreSQL, or an HTTP operational service).
- In-memory mock functions (`fake_bed_data()`, `mock_hospital_api()`) are permitted only for unit testing during early development, but must **not** serve as the final real-system integration.
- The architecture flow must remain:
  `Real Operational Database/Service ──► MCP / Tool Interface ──► TrueForge ──► AIMBULENCE Agent`

---

## 9. TrueForge Integration Rules
- TrueForge is the required harness for the agent runtime.
- Do not replace TrueForge with LangChain, CrewAI, AutoGen, or raw LLM API scripts as the top-level orchestrator.
- Use TrueForge's native primitives for:
  - Agent loop execution
  - MCP tool registration and dispatch
  - Human approval checkpoints (pausing and resuming agent state)
  - Sandboxed tool/code execution where required

---

## 10. Sandboxed Execution Environment
- Any dynamic shortage calculations, optimization scripts, or generated code must execute within an isolated sandbox environment.
- Never execute arbitrary or model-generated code directly on the host system without sandboxing and strict execution timeouts.

---

## 11. Secrets and Credential Hygiene
- **Zero Tolerance for Secrets:** NEVER commit API keys, tokens, passwords, database credentials, or `.env` files to git.
- Maintain a sanitized `.env.example` file with dummy placeholder values.
- Include `.env`, `*.pem`, `*.key`, and secret files in `.gitignore`.

---

## 12. Git & Version Control Discipline
- Keep commits small, atomic, and well-described.
- Never rewrite shared Git history (no rebasing shared public branches).
- Never force push (`git push -f`).
- Respect branch boundaries; do not delete or overwrite a teammate's branch.

---

## 13. Two-Member Parallel Development Ownership
To eliminate merge conflicts and ensure clear accountability:

- **Member 1 (Agent / Backend / Runbook Engine):**
  - Owns: `backend/`, `backend/app/agent/`, `backend/app/tools/`, `backend/app/runbooks/`, TrueForge integration, approval and verification logic.
- **Member 2 (Frontend / UI / Operator Experience):**
  - Owns: `frontend/`, UI components, emergency dashboard, operator approval modal, runbook visualizer, frontend API client.

**Rule:** Neither member modifies the other's core directories without prior review and explicit agreement.

---

## 14. API Contracts First
- Backend and frontend teams must define and document JSON schemas and REST/WebSocket contracts before building interdependent features.
- Never introduce breaking changes to API schemas or event payloads unilaterally.

---

## 15. Error Handling & Fail-Safe Execution
- Never swallow exceptions silently with empty `catch` or `except: pass` blocks.
- If a tool fails, the agent must fail safely:
  ```
  TOOL ERROR ──► STOP ──► REPORT EXCEPTION ──► VERIFY CURRENT SYSTEM STATE ──► AWAIT OPERATOR GUIDANCE
  ```
- The agent must not guess or hallucinate state mutations when a tool fails.

---

## 16. Approval Checkpoint Specifications
When the agent requests human authorization for a RED action, it must present a structured approval proposal:
1. **Target Action:** Name of the proposed operation.
2. **Operational Rationale:** Why the action is necessary (e.g., "Surge of 42 casualties creates a deficit of 30 ED beds").
3. **Projected Impact:** What resources will be modified or diverted (e.g., "Postpones 4 elective surgeries in OR-3 and OR-4").
4. **Affected Resources:** Explicit listing of affected hospital units.
5. **Current vs. Post-Action State:** Clear before-and-after comparison.
6. **Required Decision:** Human operator must be given explicit options: **[APPROVE]**, **[MODIFY]**, or **[REJECT]**.
7. **UI State:** The dashboard must prominently indicate that the agent is paused and waiting for human input.

---

## 17. State Verification Requirement
- Never assume an action succeeded simply because a tool returned an HTTP 200 or did not throw an exception.
- After every critical state mutation, the agent must execute a verification tool call to re-query the connected system and confirm that the intended operational status actually changed.

---

## 18. Auditability & Observability
Every runbook execution must generate an immutable, chronological audit trail recording:
- Incident ID and timestamp
- Active runbook identifier
- Step index and description
- Raw tool input arguments and output responses
- Safety tier classification (GREEN / YELLOW / RED)
- Human approval request payload, timestamp, and operator decision
- Post-action verification result
- Any error, retry, or escalation events

---

## 19. Documentation Truthfulness
- Maintain absolute accuracy in all project documentation:
  - Never mark an unwritten feature as completed.
  - Never invent synthetic test passes that have not run.
  - Never fabricate third-party tool integrations.
  - Mark upcoming features clearly as `(Planned)` or `(TODO)`.

---

## 20. Testing Requirements
Before releasing any vertical slice, verify:
1. **Happy Path:** Full workflow from incident intake to verified completion.
2. **Approval Path:** Agent halts at RED checkpoint and resumes only after approval signal.
3. **Rejection Path:** Agent halts when human operator rejects an action, adapting or escalating safely.
4. **Failure Path:** Graceful error handling when a tool call fails or the database is unreachable.
5. **Input Validation:** Rejection of malformed or invalid incident payloads.

---

## 21. Performance & Model Efficiency
- Use deterministic code (Python algorithms) for capacity calculations, arithmetic deficits, and rule-based validations.
- Reserve LLM reasoning for high-value tasks: runbook step synthesis, unstructured incident parsing, and explanatory summaries for the human operator.
- Avoid passing huge, unparsed payloads into prompts. Maintain clean, token-efficient context.

---

## 22. Demo-First Development
Every line of code and documentation must directly advance the core 5-minute hackathon demo:
```
Emergency Incident Arrives
         ↓
AIMBULENCE Receives Alert
         ↓
Agent Queries Real Operational DB
         ↓
Runbook Selected & Deficit Computed
         ↓
Safe (GREEN) Actions Executed
         ↓
TRUEFORGE APPROVAL CHECKPOINT (RED)
         ↓
Human Authorizes Surge Intervention
         ↓
Agent Executes & Verifies State Mutation
         ↓
Live Dashboard & Audit Log Confirmed
```

---

## 23. Change Protocol for AI Assistants
Before making any significant code modification:
1. Inspect the existing repository structure and files.
2. Formulate a brief, structured summary:
   - What currently exists
   - What is missing
   - Exactly what files will be created or modified
   - Why the change is necessary
3. Implement in minimal, clean, verified steps.

---

## 24. Current Development Phase

```
============================================================
CURRENT PHASE: PHASE 0 — DOCUMENTATION & GOVERNANCE
============================================================
```

**MANDATORY RULES FOR PHASE 0:**
- ⛔ **DO NOT** implement the agent code yet.
- ⛔ **DO NOT** create backend server implementations yet.
- ⛔ **DO NOT** create frontend UI applications yet.
- ⛔ **DO NOT** introduce temporary mocks or fake data scripts yet.
- ✅ **DO** ensure `README.md`, `instruction.md`, and repository governance files are complete, strictly aligned, and reviewed.
