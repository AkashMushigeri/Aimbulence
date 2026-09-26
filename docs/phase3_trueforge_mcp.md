# AIMBULENCE — Phase 3: TrueForge + MCP Integration

> **Role:** Member 1 / Team Lead (Backend, Agent, Runbook Engine)  
> **Repository:** [https://github.com/AkashMushigeri/Aimbulence](https://github.com/AkashMushigeri/Aimbulence)  
> **Current Status:** Verified Working Minimal Vertical Slice  

---

## 1. Environment & Runtime Versions

| Component | Installed Version | Notes |
| :--- | :--- | :--- |
| **Node.js** | `v24.19.0` (LTS) | Upgraded via winget from `v20.20.2` to satisfy TrueForge `>=22.14.0` |
| **npm** | `11.17.0` | Node Package Manager |
| **Python** | `3.11.9` | Virtual environment at `.venv` |
| **TrueForge** | `@truefoundry/trueforge@0.2.1` | Verified locally via `npx @truefoundry/trueforge` |
| **MCP SDK (Python)** | `mcp@2.2.0` | Official Python Model Context Protocol implementation |
| **Database** | SQLite + SQLAlchemy 2.1 | `hospital_operations.db` |

---

## 2. TrueForge Installation & Discovery Method

- **Package:** Official `@truefoundry/trueforge` on npm registry (published by TrueFoundry, MIT licensed).
- **Execution Command:**
  ```bash
  npx @truefoundry/trueforge --port 8790
  ```
- **Harness Capabilities Verified:**
  - Standalone SQLite runtime metadata store (`db.sqlite` at `%LOCALAPPDATA%\trueforge\Data\db`).
  - OpenAPI & REST endpoints available at `/api/v1/docs` and `/api/v1/openapi.json`.
  - Remote MCP server catalog and registration endpoints (`/api/v1/mcp-servers`).
  - Tool approval selector support (`@all`, `@write`, `@destructive`, or specific tool names).

---

## 3. Architecture & Execution Path

The vertical slice proves the end-to-end tool execution pipeline:

```
                     EMERGENCY INCIDENT
                  (42 Incoming Casualties)
                             │
                             ▼
         ╔═════════════════════════════════════════╗
         ║            TRUEFORGE HARNESS            ║
         ║     (@truefoundry/trueforge v0.2.1)     ║
         ╚═════════════════════════════════════════╝
                             │
                    Model Context Protocol
                   (JSON-RPC / SSE / stdio)
                             │
                             ▼
         ┌─────────────────────────────────────────┐
         │         AIMBULENCE MCP SERVER           │
         │      (backend/app/mcp/server.py)        │
         └───────────────────┬─────────────────────┘
                             │
                     Direct Python Calls
                             │
                             ▼
         ┌─────────────────────────────────────────┐
         │       PHASE 2 OPERATIONAL TOOLS         │
         │   - get_hospital_capacity (GREEN)       │
         │   - calculate_resource_shortage (GREEN) │
         │   - create_operational_task (GREEN)     │
         │   - reserve_resource (YELLOW / RED)     │
         │   - verify_operational_status (GREEN)   │
         └───────────────────┬─────────────────────┘
                             │
                     SQLAlchemy ORM
                             │
                             ▼
         ┌─────────────────────────────────────────┐
         │        PERSISTENT SQLite STORE          │
         │       (hospital_operations.db)          │
         └─────────────────────────────────────────┘
```

---

## 4. Exposed MCP Operational Tools

The AIMBULENCE MCP server (`backend/app/mcp/server.py`) exposes 6 tools directly backed by real database operations:

| Tool Name | Safety Tier | Purpose & SQLite Interaction |
| :--- | :---: | :--- |
| `get_hospital_capacity` | 🟢 GREEN | Reads live emergency beds (12 available / 20 total), ICU (4 available / 10 total), open ORs (2 open / 5 total), on-duty staff, ambulances, and blood inventory. |
| `calculate_resource_shortage` | 🟢 GREEN | Dynamically computes deficits against casualty demand. For 42 casualties: computes **30 emergency bed deficit**, 4 ICU deficit, and 3 OR deficit. |
| `get_resource_status` | 🟢 GREEN | Queries detailed status for specific resource categories (`bed`, `operating_room`, `staff`, `ambulance`, `blood`). |
| `create_operational_task` | 🟢 GREEN | Persists internal operational coordination tasks (`OperationalTaskRecord`) in SQLite. |
| `reserve_resource` | 🟡 YELLOW / 🔴 RED | Atomically reserves available assets. Attempting to reserve in-use surgical suites (`OR-3`, `OR-4`, `OR-5`) triggers the **RED approval gate**, halting execution without mutating state. |
| `verify_operational_status` | 🟢 GREEN | Queries database post-execution and asserts whether the expected state materialized on disk. |

---

## 5. Safety Test: RED Action Gate Verification

Attempting to preempt or reserve an in-use surgical suite (`OR-3`, occupied by an elective knee arthroscopy) via the MCP layer:

```json
{
  "status": "APPROVAL_REQUIRED",
  "risk_level": "RED",
  "safety_category": "RED",
  "requires_human_approval": true,
  "resource_type": "operating_room",
  "resource_id": "or-03",
  "resource_code": "OR-3",
  "reason": "Operating room 'OR-3' is IN_USE for elective surgery ('Elective Arthroscopic Knee Debridement'). Preemption requires explicit human approval.",
  "previous_state": {
    "status": "IN_USE",
    "scheduled_procedure": "Elective Arthroscopic Knee Debridement"
  },
  "new_state": {
    "status": "IN_USE"
  }
}
```

* **Database Integrity:** `OR-3` remains `IN_USE` with its scheduled procedure intact in the SQLite database.
* **Audit Trail:** A `CONSEQUENTIAL_ACTION_BLOCKED` event is logged to the persistent `audit_events` table.
* **No Bypass:** The MCP layer cannot execute or bypass this gate without explicit human authorization.

---

## 6. Test Suite & Verification Commands

### Running All Automated Tests (25 Tests)
```bash
# From repository root with virtual environment activated:
pytest -v
```

### Test Suite Coverage
* `backend/tests/test_contracts.py` (7 tests): API route contracts and database restart survival.
* `backend/tests/test_tools.py` (11 tests): Phase 2 operational tools, concurrency locking, and safety tiers.
* `backend/tests/test_phase3_mcp.py` (7 tests):
  1. `test_mcp_server_initialization_and_tool_discovery`: Verifies all 6 tools are discovered with safety descriptions.
  2. `test_mcp_get_hospital_capacity_reaches_sqlite`: Verifies SQLite capacity read via MCP.
  3. `test_mcp_calculate_resource_shortage_42_casualties`: Verifies 30-bed deficit calculation for 42 casualties.
  4. `test_mcp_create_operational_task_persists`: Verifies task record persistence via MCP.
  5. `test_mcp_verify_operational_status_confirms`: Verifies post-execution state verification via MCP.
  6. `test_mcp_red_action_blocked_without_mutation`: Verifies RED gate blocks `OR-3` preemption without DB mutation.
  7. `test_trueforge_vertical_slice_end_to_end`: End-to-end execution of the 5-step vertical slice.

### Running the Vertical Slice Runner Directly
```bash
python -m backend.app.agent.trueforge_runner
```

---

## 7. Known Limitations & Phase 4 Requirements

1. **Phase 3 Scope Limitation:** Phase 3 only establishes the tool-execution path, MCP interface, and safety gating. It does not implement autonomous LLM multi-step reasoning or the full 15-step MCI runbook.
2. **Phase 4 Human-in-the-Loop Gateway:** Phase 4 will connect TrueForge's human approval checkpoint mechanism to the operator dashboard, enabling interactive **[APPROVE]**, **[MODIFY]**, or **[REJECT]** decisions for RED actions.
