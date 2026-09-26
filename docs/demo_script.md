# AIMBULENCE — Official Live Demonstration Script

> **Project:** AIMBULENCE — AI Emergency Hospital Operations Runbook Executor  
> **Tagline:** *"Act Fast. Coordinate Smart. Keep Humans in Control."*  
> **Target Run Time:** 3 – 5 minutes  
> **Primary Audience:** Hackathon Judges, Clinical Operations Directors, AI Safety Evaluators  

---

## 1. Executive Demonstration Overview

AIMBULENCE demonstrates how autonomous AI agents can safely orchestrate critical hospital operations during a Mass Casualty Incident (MCI) **without ever bypassing human command**.

### Core Demonstration Tenet
> **"Autonomous in execution, but not autonomous in authority."**

The system executes routine operational coordination autonomously (GREEN and YELLOW actions), but **strictly halts** at consequential decisions (RED actions)—such as commandeering active surgical suites—until an authorized human provides single-use cryptographic approval.

---

## 2. Pre-Demo Setup & Environment Verification

### Prerequisites
1. **Backend Server:** Running on `http://localhost:8000`
   ```powershell
   cd backend
   uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```
2. **Frontend Dashboard:** Running on `http://localhost:3000`
   ```powershell
   cd frontend
   npm run dev
   ```
3. **Database State:** Seeded with clean baseline:
   ```bash
   curl -X POST http://localhost:8000/api/demo/reset
   ```

---

## 3. Step-by-Step Presentation Script

```
Timeline:
[0:00 - 0:45] Intro & Incident Genesis
[0:45 - 1:45] Autonomous Fast-Track (Steps 1–9)
[1:45 - 2:45] TrueForge Safety Intercept (Step 10 — OR-3)
[2:45 - 3:45] Authorization, Verification & Runbook Completion
[3:45 - 4:45] Rejection Path & Zero-Mutation Proof (Optional/Q&A)
```

---

### Act 1: The Crisis Emerges (0:00 – 0:45)
**Presenter Action:** Open the AIMBULENCE Operator Dashboard (`http://localhost:3000`). Point to the live hospital telemetry widgets (ICU beds, blood bank units, active ORs).

**Presenter Speaking Track:**
> *"Imagine this: St. Jude Trauma Center receives a Category 1 Mass Casualty alert. A multi-vehicle highway collision with 18 critical casualties inbound. In a typical hospital, the charge nurse and operational staff must execute dozens of operational phone calls, resource checks, and coordination runbooks while patients are bleeding out.*
>
> *Enter AIMBULENCE: an AI runbook executor that automates coordination while keeping hospital leadership in full command."*

---

### Act 2: Autonomous Coordination (0:45 – 1:45)
**Presenter Action:** Click **"Trigger MCI-01 Runbook"** in the dashboard.

**Visual Cue:**
- Status badge switches to `RUNNING`.
- Live event stream begins executing Steps 1 through 9 rapidly.
- Emergency department alert broadcasts.
- Triage zone is established in the Emergency Bay.
- Blood bank O-negative units are staged.
- Supply shortages are dynamically recalculated.

**Presenter Speaking Track:**
> *"Notice the velocity. In seconds, AIMBULENCE has:
> 1. Verified telemetry against hospital SQLite operational records.
> 2. Dispatched trauma triage kits (GREEN action).
> 3. Reserved 10 units of emergency uncrossmatched O-negative blood (YELLOW action).
> 4. Scaled ER nursing staff rosters.*
>
> *These are reversible, operational preparations. The agent coordinates them with zero friction, freeing staff to prep trauma bays."*

---

### Act 3: The TrueForge Intercept (1:45 – 2:45)
**Visual Cue:**
- Runbook abruptly pauses at **Step 10: Commandeer Operating Room 3 (`OR-3`)**.
- Status changes to `PAUSED_FOR_APPROVAL` (flashing amber).
- The TrueForge Checkpoint Modal pops up on the operator's screen.

**Presenter Action:** Do NOT click anything yet. Hover over the TrueForge Security Badge and blast-radius summary in the modal.

**Presenter Speaking Track:**
> *"Now look at Step 10. The AI determines that trauma surgery demands immediate access to Operating Room 3.
> But `OR-3` is currently occupied by an elective gallbladder laparoscopic procedure.
> 
> A standard autonomous agent might wipe that schedule and reassign the room, endangering the elective patient on the table.
> 
> AIMBULENCE does not have the authority to do that. Under our TrueForge safety model, commandeering an active operating room is classified as a RED consequential action. 
> 
> The system generates an immutable proposal, binds it to a single-use cryptographic token, and halts all execution. Notice our database: `OR-3` has NOT been mutated. The AI cannot touch it without human sign-off."*

---

### Act 4: Human-in-the-Loop Authorization & Completion (2:45 – 3:45)
**Presenter Action:** Click **"Authorize & Commandeer OR-3"** inside the TrueForge modal.

**Visual Cue:**
- Single-use token is transmitted to `POST /api/approvals/{id}/respond`.
- Cryptographic signature validates; action executes.
- `OR-3` status in SQLite changes from `IN_USE` to `COMMANDEERED_MCI`.
- Runbook transitions from `PAUSED_FOR_APPROVAL` back to `RUNNING`.
- Steps 11 through 15 execute: surgical team notified, patient diverted, recovery beds cleared.
- Final Status: `COMPLETED`. Hospital Readiness Summary displays 100% preparation score.

**Presenter Speaking Track:**
> *"With one verified click from the medical director, the single-use token is consumed. 
> 
> The operational database records the mutation, an immutable audit record is logged with timestamp and operator ID, and the runbook resumes seamlessly to finalize the hospital's trauma readiness.
> 
> That is autonomous execution with human authority."*

---

## 4. Alternative Scenario: Human Rejection & Safety Proof (Bonus / Q&A)

To demonstrate that safety is mathematically guaranteed, demonstrate the rejection workflow:

1. **Trigger Demo Reset:**
   ```bash
   curl -X POST http://localhost:8000/api/demo/reset
   ```
2. **Re-trigger MCI-01 Runbook.**
3. When the Step 10 TrueForge modal appears, select **"Reject / Deny Action"** and enter rationale: *"Elective patient in critical suturing phase; divert to OR-4 instead."*
4. **Observe:**
   - Runbook immediately terminates with status `HALTED_REJECTED`.
   - `OR-3` status is queried directly in the database:
     ```bash
     curl http://localhost:8000/api/resources/OR-3
     ```
   - **Verification:** Status remains `IN_USE`. **Zero accidental modifications occurred.**
   - Audit trail registers event `APPROVAL_REJECTED` with reason and operator metadata.

---

## 5. Live Presenter Q&A Talking Points

| Question / Challenge | Presenter Answer |
| :--- | :--- |
| **"Does the AI diagnose patients?"** | *"Never. AIMBULENCE strictly operates on hospital logistics and facility resources: bed allocations, blood bank reserves, OR availability, and triage staging. No diagnostic or clinical treatment AI is involved."* |
| **"What if the agent tries to forge a token?"** | *"Tokens are cryptographically generated in memory and bound to specific action IDs, target resources, and expiration windows. Any replay, modification, or bypass attempt results in an immediate 403 Forbidden and audit alarm."* |
| **"Can it survive network or server reboots?"** | *"Yes. Every runbook state, step outcome, and token approval is persisted in ACID-compliant SQLite transactions. If the backend restarts mid-run, it recovers exact step state upon reboot."* |

---

## 6. Emergency Recovery Commands (Presenter Backup)

If local ports are blocked or state needs quick recovery during presentation:

```powershell
# Kill hanging python or node processes
taskkill /F /IM python.exe /T
taskkill /F /IM node.exe /T

# Instant database and agent memory reset
curl -s -X POST http://localhost:8000/api/demo/reset
```
