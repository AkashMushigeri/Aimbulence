# AIMBULENCE

> **AI Emergency Hospital Operations Runbook Executor**  
> Built for the **Agents That Act** Hackathon (TrueFoundry × Polaris / HackCulture)  
> **Theme:** RUNBOOK EXECUTOR  
> **Repository:** [https://github.com/AkashMushigeri/Aimbulence](https://github.com/AkashMushigeri/Aimbulence)

---

## One-Line Description
An autonomous, safety-gated AI operational runbook executor that coordinates hospital capacity, staff dispatch, and critical resources during mass-casualty emergencies on TrueForge.

---

## Problem
During a Mass-Casualty Incident (MCI)—such as a multi-vehicle highway collision, transit accident, or structural collapse—hospitals face sudden, overwhelming surges of incoming trauma casualties (e.g., 40+ acute arrivals within minutes). 

In these critical moments, hospital operations teams experience extreme friction:
- **Operational Chaos & Cognitive Overload:** Staff must evaluate bed availability, surgical capacity, nursing shortages, blood bank reserves, and oxygen supplies simultaneously while coordinating under high stress.
- **Static, Inefficient Runbooks:** Hospital disaster plans reside in static paper binders or static PDFs that humans must manually parse, calculate, and coordinate step-by-step.
- **Fragmented Tooling & Delayed Action:** Emergency managers toggle between EHR bed boards, staff paging systems, OR schedulers, and facility logs, causing critical delays in surge readiness.
- **Risk of Unauthorized Escalations:** Without clear authority boundaries, automated or hurried decisions risk disruptive changes (diverting ambulances, cancelling elective surgeries, activating regional trauma mutual-aid) without executive clinical oversight.

---

## Solution
**AIMBULENCE** is an AI Emergency Hospital Operations Runbook Executor. It bridges real operational hospital data systems and dynamic emergency response procedures.

Instead of acting as a conversational text assistant, AIMBULENCE operates as a runbook execution agent:
1. Ingests incoming emergency dispatch notifications.
2. Connects to real hospital operational systems via tool/MCP interfaces to assess real-time bed, staff, and supply availability.
3. Selects and instantiates the verified Mass-Casualty Hospital Response Runbook.
4. Generates a phased operational response plan.
5. Autonomously executes safe, reversible tasks (e.g., resource auditing, internal staging, notifications).
6. **Hard-stops at consequential decision checkpoints**, requesting human operator authorization with transparent impact analysis.
7. Resumes execution post-approval and independently verifies that target operational states were reached.

---

## Why This Is an Agent (Not a Chatbot)
AIMBULENCE is fundamentally distinct from an informational LLM chatbot:
- **Reaches Real External Systems:** Interacts directly with database systems, scheduling backends, and communication APIs through standard Model Context Protocol (MCP) and tool interfaces.
- **Reads & Maintains Operational State:** Maintains an active state model of hospital surge capacity, tracking shifts in available beds, operating theaters, and medical equipment.
- **Reasons Over Executable Runbooks:** Translates high-level emergency protocols into ordered, dependency-aware tool actions rather than freeform text answers.
- **Performs Real Actions:** Issues concrete state mutations—updating operational statuses, reserving staging areas, and dispatching on-call resource mobilization.
- **Verifies State Changes:** Never assumes action success; queries connected systems after execution to confirm that changes materialized.
- **Enforces Safety Boundaries:** Knows precisely when to stop. Consequential actions require explicit human authorization before execution.
- **Stateful Resumption:** Pauses at approval gates and continues multi-step execution seamlessly once authorized by a human coordinator.

---

## Hackathon Alignment: Agents That Act
This project is engineered to strictly satisfy the core tenets of the **Agents That Act** hackathon:

| Hackathon Requirement | AIMBULENCE Architectural Implementation |
| :--- | :--- |
| **1. Real System / Tool Access** | Reaches a real operational data store and service endpoints via standard MCP/tool calls. No mocked or fake placeholder return functions in the final deployment. |
| **2. Sandboxed Code Execution** | Utilizes an isolated execution sandbox for deterministic mathematical models (surge capacity formulas, triage shortage calculations). |
| **3. Human Approval Checkpoint** | Enforces a strict TrueForge approval gate prior to executing any consequential, irreversible, or high-impact operational action (RED actions). |
| **4. TrueForge Harness** | TrueForge serves as the foundational agent runtime, MCP tool provider, checkpoint coordinator, and state management engine. |
| **5. End-to-End Execution** | Demonstrates a full autonomous loop: Emergency Detection → State Assessment → Plan Generation → Safe Action → Human Gate → Continued Action → State Verification. |

---

## Core Workflow
The agent executes an iterative operational loop:

```
DETECT ──► ASSESS ──► SELECT RUNBOOK ──► PLAN ──► ACT ──► VERIFY ──► ADAPT / ESCALATE
```

1. **DETECT:** Ingests incident telemetry and casualty alert feeds.
2. **ASSESS:** Queries real connected hospital data to determine immediate availability across critical resources.
3. **SELECT RUNBOOK:** Matches incident profile against standardized emergency runbook templates.
4. **PLAN:** Produces an executable, phased action sequence mapping runbook steps to tool calls.
5. **ACT:** Executes non-consequential (GREEN) actions automatically; halts at consequential (RED) actions for human sign-off.
6. **VERIFY:** Performs follow-up inspections on connected systems to ensure intended operational modifications took effect.
7. **ADAPT / ESCALATE:** Re-evaluates remaining capacity bottlenecks; prompts human command if interventions fail or resource limits persist.

---

## First Use Case & Scenario
- **Incident:** Mass-Casualty Road Collision (Multi-Vehicle Highway Transit Accident).
- **Incident Scale:** 42 acute casualties anticipated to arrive within 25 minutes.
- **Hospital Baseline Constraints:**
  - Emergency Department (ED) Beds: 12 available (Deficit: 30)
  - Intensive Care Unit (ICU) Beds: 4 available
  - Operating Rooms (OR): 2 staffed and open; 3 currently in non-urgent elective use
  - Trauma Surgeons: 3 on duty
  - Emergency Care Nurses: 8 available
  - Blood Bank: 18 units O-negative blood on hand
- **Agent Mission:** Mobilize surge capacity, audit resource deficits, stage non-urgent areas for triage, and request command approval to initiate surge reallocations before ambulances arrive.

---

## Mass-Casualty Response Runbook (`MCI-01`)
The initial vertical slice focuses on this structured operational sequence:

```
 1. Receive Emergency Incident Alert
 2. Validate Incident Parameters & Integrity
 3. Assess Incident Severity & Projected Casualty Intake
 4. Query Hospital Operational Capacity (ED, ICU, OR)
 5. Query Staff Availability (Trauma Specialists, Surgical Teams, Emergency Nurses)
 6. Inspect Critical Consumables & Blood Bank Reserves
 7. Compute Projected Deficits & Capacity Shortages
 8. Synthesize Phased Response Plan
 9. Execute Safe Actions [GREEN] (Internal alerts, triage staging, task creation)
10. Halt at Consequential Action Checkpoint [RED]
11. Present Authorization Request with Impact Briefing to Human Operator
12. Await Human Decision (Approve / Modify / Reject)
13. Execute Approved Action (e.g., Code Orange declaration, elective OR suspension)
14. Verify Operational State on Real Connected System
15. Log Immutable Audit Record; Escalate if Deficits Remain Unresolved
```

---

## Safety and Human-in-the-Loop Model

### Action Classification Framework

> **"The agent is autonomous in execution, but not autonomous in authority."**

Actions are strictly categorized into three safety tiers:

| Tier | Category | Autonomy | Action Examples |
| :---: | :---: | :---: | :--- |
| 🟢 | **GREEN** | **Automatic** | Read operational databases; calculate shortage metrics; stage emergency triage checklists; post internal staff notifications; create audit records; verify action outcomes. |
| 🟡 | **YELLOW** | **Confirmation** | Reserve auxiliary staging beds; reassign on-call nursing teams within standard shift parameters; request routine inventory transfers from regional storage. |
| 🔴 | **RED** | **Human Approval Required** | Declare Code Orange / Hospital Disaster Status; suspend elective surgeries; clear active recovery bays; divert incoming non-trauma ambulances; issue regional mutual-aid calls. |

### Operational Boundaries & Non-Goals
AIMBULENCE is an **operational coordinator**, NOT a clinical practitioner:
- ❌ **Does NOT diagnose patients** or recommend diagnostic tests.
- ❌ **Does NOT prescribe medications** or recommend pharmaceutical dosing.
- ❌ **Does NOT make clinical triage decisions** (e.g., assigning clinical triage tags to individual human beings).
- ❌ **Does NOT replace medical doctors, nurses, or hospital administrators.**
- ❌ **Does NOT use real patient records or Personally Identifiable Information (PII).** All operational hospital data is synthetic.
- ❌ **Does NOT dispatch public alerts or external emergency service re-routings** without explicit human executive sign-off.

---

## Architecture

```
                  EMERGENCY INCIDENT
               (Simulated Mass Casualty)
                          │
                          ▼
               ┌──────────────────────┐
               │   AIMBULENCE AGENT   │
               └──────────┬───────────┘
                          │
                          ▼
               ┌──────────────────────┐
               │      TRUEFORGE       │
               │ (Harness / Checkpoint│
               │  Runtime & State)    │
               └──────────┬───────────┘
                          │
         ┌────────────────┴────────────────┐
         ▼                                 ▼
┌──────────────────┐             ┌───────────────────┐
│  RUNBOOK ENGINE  │             │ SANDBOX EXECUTION │
│ (MCI Procedures) │             │ (Math / Shortage) │
└────────┬─────────┘             └─────────┬─────────┘
         │                                 │
         └────────────────┬────────────────┘
                          ▼
               ┌──────────────────────┐
               │   MCP / TOOL LAYER   │
               └──────────┬───────────┘
                          │
         ┌────────────────┴────────────────┐
         ▼                                 ▼
┌──────────────────┐             ┌───────────────────┐
│  REAL CONNECTED  │             │  VERIFICATION &   │
│  DATABASE/SYSTEM │             │  STATE INSPECTOR  │
│ (Synthetic Ops)  │             └───────────────────┘
└────────┬─────────┘
         │
         ▼
 ╔═══════════════════════════════════════════════════╗
 ║           TRUEFORGE APPROVAL CHECKPOINT           ║
 ║        [Human Authorization Gate (RED)]          ║
 ╚═══════════════════════════════════════════════════╝
         │                                 │
         ▼                                 ▼
  [APPROVED]                          [REJECTED]
         │                                 │
         ▼                                 ▼
Execute Consequential Action        Halt / Adapt Runbook
         │
         ▼
Verify State Mutated on System
         │
         ▼
Update Dashboard & Audit Trail
```

---

## Technology Stack

> *Note: Components marked as **Planned** reflect architecture designs for implementation phases.*

- **Agent Runtime & Harness:** TrueForge *(Planned - Mandatory Requirement)*
- **LLM Provider:** Anthropic / OpenAI / Gemini via TrueForge integration *(Planned)*
- **Tool Protocol:** Model Context Protocol (MCP) *(Planned)*
- **Backend Framework:** Python 3.11+ / FastAPI *(Planned)*
- **Frontend / Operator Dashboard:** React / Next.js / Tailwind CSS *(Planned)*
- **Connected Operational Store:** Real Relational Database (PostgreSQL / SQLite with typed operational schema) *(Planned)*
- **Isolated Code Sandbox:** Containerized / Sandboxed Python runtime for capacity algorithms *(Planned)*
- **Version Control & CI:** Git / GitHub *(Active)*

---

## Planned Project Structure
```
Aimbulence/
├── README.md                  # Project overview and hackathon guide
├── instruction.md             # Developer & AI agent operating instructions
├── LICENSE                    # MIT License
├── .gitignore                 # Environment and build artifact exclusions
├── .env.example               # Template for environment configuration
│
├── backend/                   # Member 1: Agent & Operations Engine (Planned)
│   ├── app/
│   │   ├── agent/             # TrueForge agent definition & loop
│   │   ├── runbooks/          # Machine-readable MCI runbooks
│   │   ├── tools/             # MCP tools (DB connector, notification, capacity)
│   │   ├── sandbox/           # Sandboxed code execution for shortage math
│   │   ├── models/            # Pydantic data schemas
│   │   └── api/               # REST API & WebSocket endpoints
│   ├── tests/                 # Automated test suite
│   └── requirements.txt       # Python dependencies
│
├── frontend/                  # Member 2: Operator UI & Visualizer (Planned)
│   ├── src/
│   │   ├── components/        # Dashboard, Approval Checkpoint Modal, Runbook Visualizer
│   │   ├── pages/             # Live Operations Control Center
│   │   └── services/          # API client
│   ├── package.json
│   └── tsconfig.json
│
└── docs/                      # Technical references & runbook specifications (Planned)
    ├── architecture.md
    └── runbooks/
```

---

## Setup & Local Development (Planned)

> [!NOTE]
> Implementation is currently in **Phase 0 (Documentation)**. Setup commands below represent the target development configuration.

### Prerequisites (Planned)
- Python 3.11+
- Node.js 18+ & npm
- TrueForge CLI & Account Credentials
- Git

### Backend Setup (TODO - Phase 1)
```bash
# Clone the repository
git clone https://github.com/AkashMushigeri/Aimbulence.git
cd Aimbulence

# Setup Python Virtual Environment (TODO)
python -m venv venv
source venv/bin/activate  # On Windows: .\venv\Scripts\activate

# Install Dependencies (TODO)
pip install -r backend/requirements.txt

# Configure Environment Variables (TODO)
cp .env.example .env
```

### Frontend Setup (TODO - Phase 1)
```bash
# Navigate to frontend (TODO)
cd frontend
npm install

# Run development server (TODO)
npm run dev
```

---

## Configuration

Configuration will be managed via environment variables. **No secret, API key, or credential may ever be committed to the repository.**

Target variables (`.env.example`):
```bash
# Environment Configuration (Example)
TRUEFORGE_API_KEY=your_trueforge_api_key_here
LLM_API_KEY=your_llm_api_key_here
DATABASE_URL=sqlite:///./hospital_ops.db
ENVIRONMENT=development
PORT=8000
```

---

## Planned 5-Minute Demo Flow

1. **Trigger Incident:** The human operator opens the AIMBULENCE Live Operations Dashboard and clicks **"SIMULATE MASS CASUALTY"** (42 incoming casualties from highway transit collision).
2. **Agent Detection & Assessment:** The AIMBULENCE agent receives the event payload and immediately queries the real connected database for current bed, surgical, and staffing capacity.
3. **Runbook Selection & Shortage Math:** The agent matches the incident to Runbook `MCI-01`, executes deterministic shortage calculations in the sandbox, and identifies critical deficits (e.g., 30 bed deficit, 2 open OR deficit).
4. **Autonomous Safe Execution (GREEN):** The agent automatically posts internal alert notices, stages the triage intake log, and verifies successful record creation.
5. **The Checkpoint (RED):** The agent plans a consequential action: *Activate Emergency Disaster Protocol (Code Orange), divert non-urgent admissions, and clear recovery bays.* The agent halts execution at the TrueForge approval gate.
6. **Human-in-the-Loop Decision:** The operator dashboard transitions into an urgent approval state showing:
   - Specific action to execute
   - Rationale and shortage data
   - Affected hospital departments
   - Risk assessment
   - Operator actions: **[APPROVE]**, **[MODIFY]**, **[REJECT]**
7. **Action Execution & Verification:** The operator clicks **APPROVE**. The agent resumes execution, commits the state change to the live database, queries the system to verify that the status changed to `CODE_ORANGE_ACTIVE`, and confirms surge capacity has been unlocked.
8. **Dashboard & Audit Update:** The UI updates in real time, displaying the verified operational status and an immutable audit trail of all steps, approvals, and outcomes.

---

## Safety & Data Ethics
- **Synthetic Data Exclusively:** All hospital bed numbers, surgeon rosters, inventory counts, and casualty volumes are strictly synthetic. No Protected Health Information (PHI) or real hospital data is used.
- **Strictly Non-Clinical:** The agent coordinates logistics, facilities, and staff mobilization. It never advises on patient care or medical decisions.
- **Fail-Safe Operation:** If any tool call encounters an error or network partition, the agent fails safely: halts, alerts the human operator, and logs the exception.

---

## Development Status & Roadmap

- **Phase 0 — Documentation & Governance (CURRENT)**
- Phase 1 — Foundation & Repository Initialization *(Planned)*
- Phase 2 — Real Operational Tool & Database Connection *(Planned)*
- Phase 3 — Agent Harness & Runbook Engine *(Planned)*
- Phase 4 — TrueForge Human Approval Checkpoints *(Planned)*
- Phase 5 — Verification & State Auditing *(Planned)*
- Phase 6 — UI Integration & Demo Hardening *(Planned)*

---

## AI Assistance Disclosure
In accordance with the hackathon submission requirements, AI coding assistants (such as Antigravity / Google DeepMind agentic tools) are utilized during development for code generation, documentation structuring, and test creation. All generated architecture and logic are reviewed, validated, and tested by the team.

---

## Team

- **Member 1:** AIMBULENCE Agent / Backend / Runbook Engine
- **Member 2:** AIMBULENCE Frontend / UX / Operator Interface

---

## License
This project is licensed under the [MIT License](LICENSE) - see the [LICENSE](LICENSE) file for details.