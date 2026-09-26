# AIMBULENCE — Safety and Human Governance Model

> **Project:** AIMBULENCE — AI Emergency Hospital Operations Runbook Executor  
> **Core Axiom:** *"Autonomous in execution, but not autonomous in authority."*  
> **Status:** Final Architectural Specification  

---

## 1. Fundamental Philosophy: Autonomy vs. Authority

In high-stakes, time-critical environments like emergency hospital operations during a Mass Casualty Incident (MCI), pure manual coordination causes deadly delays, while unconstrained autonomous AI introduces unacceptable operational risk.

AIMBULENCE resolves this dilemma through a strict separation of powers:

```
┌────────────────────────────────────────────────────────┐
│                   EXECUTION LAYER                      │
│                (AIMBULENCE AI Agent)                   │
│  - Reads operational telemetry                         │
│  - Calculates resource deficits                        │
│  - Dispatches routine tasks & notifications            │
│  - Formulates complex coordination plans               │
│                                                        │
│             AUTONOMOUS IN EXECUTION                    │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼ Intercepted at Consequential Boundaries
┌────────────────────────────────────────────────────────┐
│                   AUTHORITY LAYER                      │
│            (TrueForge Human Gatekeeper)                │
│  - Evaluates clinical and operational risk             │
│  - Holds decision authority over critical resources    │
│  - Issues single-use cryptographic authorization       │
│                                                        │
│           NOT AUTONOMOUS IN AUTHORITY                  │
└────────────────────────────────────────────────────────┘
```

The AI can orchestrate, compute, and prepare with rapid speed, but **only a human clinical supervisor holds the authority to affect ongoing patient procedures or declare disaster states**.

---

## 2. Action Classification Framework (GREEN / YELLOW / RED)

Every action executed by AIMBULENCE is statically classified according to its blast radius, reversibility, and impact on existing operations:

| Tier | Category | Autonomy Level | Blast Radius | Action Examples |
| :---: | :---: | :---: | :---: | :--- |
| 🟢 | **GREEN** | **Fully Autonomous** | Zero / Internal Only | • Read capacity records & bed availability<br>• Run mathematical surge deficit formulas<br>• Dispatch internal prep checklists to trauma bays<br>• Query blood bank inventory levels<br>• Record audit log entries |
| 🟡 | **YELLOW** | **Autonomous with Notification** | Low / Readily Reversible | • Stage auxiliary triage cots in the ambulance bay<br>• Reserve uncrossmatched emergency blood units<br>• Pre-alert on-call surgical nursing personnel<br>• Stage portable ultrasound and crash carts |
| 🔴 | **RED** | **Human Approval Required** | High / Irreversible or Disruptive | • Commandeer active Operating Room 3 (`OR-3`)<br>• Suspend ongoing elective surgical procedures<br>• Declare Hospital Code Orange (Disaster Activation)<br>• Divert non-trauma ambulances to regional centers<br>• Evacuate post-op recovery suites |

---

## 3. Cryptographic Token Binding & Anti-Replay Engine

To ensure that human approval cannot be bypassed, spoofed, or replayed, AIMBULENCE implements a multi-layer cryptographic validation protocol in `backend/app/approval/checkpoint.py`:

```
   Proposal Created
          │
          ▼
Generate 32-Byte Cryptographic Nonce (Token)
Hash Token with SHA-256 Digest
Store (ActionID, TargetResource, Digest, State: PENDING)
          │
          ▼
Present Authorization Modal to Operator
          │
          ▼ Operator Clicks "Approve"
Transmit Raw Token to /api/approvals/{id}/respond
          │
          ▼ Server Verification Steps:
   1. Check Checkpoint Status == PENDING
   2. Verify SHA-256(RawToken) == Stored Digest
   3. Check ActionID and ResourceID Match Exactly
   4. Mark Token as CONSUMED
          │
          ▼
Execute Target Operational Tool & Mutate SQLite State
```

### Security Invariants Enforced:
1. **Single-Use Guarantee:** Once consumed, any subsequent request bearing the same token returns `409 Conflict`.
2. **Resource-Pinning:** A token generated for `OR-3` cannot be applied to `OR-1` or `ICU-4`. Doing so triggers `400 Bad Request`.
3. **Execution Without Token:** Direct invocation of RED tools without passing a valid token raises `403 Forbidden` (`UnauthorizedConsequentialActionError`).
4. **Rejection Permanence:** If an operator rejects an action, the token is permanently revoked (`REJECTED`) and can never be revived.

---

## 4. The Zero-Mutation Guarantee (Rejection Path)

A vital safety feature of AIMBULENCE is **zero preemptive modification**. 

When a RED action is proposed:
1. **The database is NOT touched.** 
2. Operating Room 3 remains in its existing state (`IN_USE` for an elective procedure).
3. If the operator clicks **"Reject"**:
   - The runbook transitions to `HALTED_REJECTED`.
   - The database remains completely untouched.
   - An immutable audit record (`APPROVAL_REJECTED`) logs the operator ID and rejection rationale.
   - Ongoing operations at the hospital continue completely undisturbed.

This property guarantees that an overzealous AI proposal can never disrupt hospital workflow unless a human deliberately validates it.

---

## 5. Non-Goals and Clinical Guardrails

AIMBULENCE is strictly an **operational logistics coordinator**, NOT a clinical diagnostics system. The boundaries below are inviolable:

- ❌ **Zero Clinical Diagnosis:** The system does not analyze medical images, interpret lab results, or formulate medical diagnoses.
- ❌ **Zero Pharmaceutical Decisions:** The system never orders medications, determines dosages, or adjusts infusions.
- ❌ **Zero Patient Triage Tagging:** The agent calculates aggregate bed deficits (e.g. "We need 12 more acute beds"); it never assigns triage tags (Red/Yellow/Green/Black) to individual human patients.
- ❌ **Zero Real Patient Data (PHI/PII):** The system operates entirely on synthetic hospital telemetry and facility counts. No HIPAA-protected data is processed or stored.
- ❌ **Zero Unsupervised External Commits:** The agent cannot alter regional 911 dispatch routes without explicit executive command.

---

## 6. Immutable Audit & Forensics

Every interaction within AIMBULENCE is recorded in the append-only `AuditEvent` log in SQLite:

- **Timestamps:** ISO-8601 UTC microsecond precision.
- **Actor Attribution:** Discloses whether an action was initiated by `SYSTEM_AGENT`, `MCI_RUNBOOK_ENGINE`, or `OPERATOR_USER`.
- **Payload Capture:** Stores full JSON input and output parameters, including before-and-after state hashes.
- **Audit Event Types:**
  - `TELEMETRY_READ`: Hospital capacity or resource inspection.
  - `CALCULATION_PERFORMED`: Sandboxed shortage computation.
  - `SAFE_TASK_DISPATCHED`: Automated GREEN/YELLOW action execution.
  - `CHECKPOINT_PROPOSED`: RED action paused for operator authorization.
  - `APPROVAL_GRANTED`: Cryptographic token validated and human sign-off confirmed.
  - `APPROVAL_REJECTED`: Action denied by human operator with reason.
  - `STATE_VERIFIED`: Post-execution verification confirming real disk persistence.

This audit trail ensures complete transparency and accountability for post-incident clinical governance and regulatory review.
