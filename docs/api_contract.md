# AIMBULENCE API Contract Specification

> **Target Audience:** Member 2 (Frontend Developer / UX Engineer) and Member 1 (Backend / Agent Developer)  
> **Backend Base URL:** `http://localhost:8000` (Default)  
> **Protocol:** HTTP/1.1 REST + JSON  
> **Interactive Swagger UI:** `http://localhost:8000/docs`  
> **Current Version:** `0.1.0` (Phase 1 Foundation)  

---

## 1. Overview and Engineering Rules

1. **Synthetic Data Exclusively:** All hospital bed metrics, doctor/nurse rosters, inventory levels, and incident reports are synthetic. No real patient data or Protected Health Information (PHI) is processed or stored.
2. **Implementation Status Tags:**
   - `[IMPLEMENTED]` — Fully implemented, backed by persistent SQLite database, and verified with automated tests.
   - `[PLANNED - PHASE 3/4]` — Contract shape defined for Member 2 UI scaffolding; endpoint logic will be wired during subsequent agent and approval phases.
3. **CORS:** Enabled for all local origins (`*`), allowing the frontend dev server (e.g., `http://localhost:3000`) to connect directly.

---

## 2. Implemented Endpoints (Phase 1 Foundation)

---

### 2.1 System Health Check

- **Endpoint:** `/api/health`
- **Method:** `GET`
- **Status:** `[IMPLEMENTED]`
- **Description:** Verifies service availability and active database connectivity.
- **Request Body:** None
- **Response Headers:** `Content-Type: application/json`

#### Success Response (200 OK)
```json
{
  "status": "healthy",
  "service": "aimbulence-backend",
  "database": "connected",
  "environment": "development",
  "timestamp": "2026-09-26T12:00:00.000000Z"
}
```

#### Error Response (503 Service Unavailable)
```json
{
  "detail": {
    "status": "unhealthy",
    "database": "connection failed: [error details]"
  }
}
```

---

### 2.2 Hospital Operational Capacity

- **Endpoint:** `/api/hospital/status`
- **Method:** `GET`
- **Status:** `[IMPLEMENTED]`
- **Description:** Retrieves aggregate operational capacity metrics, emergency code status, and department breakdowns.
- **Request Body:** None

#### Success Response (200 OK)
```json
{
  "hospital_name": "Metro Central Trauma Hospital",
  "operational_code": "NORMAL",
  "emergency_beds_available": 12,
  "emergency_beds_total": 20,
  "icu_beds_available": 4,
  "icu_beds_total": 10,
  "operating_rooms_available": 2,
  "operating_rooms_total": 5,
  "doctors_available": 8,
  "nurses_available": 16,
  "ambulances_available": 5,
  "blood_units_available": 30,
  "active_incidents_count": 0,
  "last_updated": "2026-09-26T12:00:00.000000Z",
  "departments": [
    {
      "name": "Emergency Department",
      "department_type": "EMERGENCY",
      "total_beds": 20,
      "available_beds": 12,
      "occupied_beds": 8,
      "staff_on_duty": 12,
      "status_note": "Normal ED intake flow"
    },
    {
      "name": "Intensive Care Unit",
      "department_type": "ICU",
      "total_beds": 10,
      "available_beds": 4,
      "occupied_beds": 6,
      "staff_on_duty": 6,
      "status_note": "Standard critical monitoring"
    },
    {
      "name": "Surgical Operations",
      "department_type": "SURGERY",
      "total_beds": 5,
      "available_beds": 2,
      "occupied_beds": 3,
      "staff_on_duty": 8,
      "status_note": "2 open ORs, 3 in scheduled non-urgent elective procedures"
    },
    {
      "name": "Blood Bank & Transfusion",
      "department_type": "BLOOD_BANK",
      "total_beds": 0,
      "available_beds": 0,
      "occupied_beds": 0,
      "staff_on_duty": 2,
      "status_note": "O-negative reserves adequate for baseline"
    }
  ]
}
```

#### Error Response (404 Not Found)
```json
{
  "detail": "Hospital operational baseline not initialized."
}
```

---

### 2.3 Detailed Resource Inventory

- **Endpoint:** `/api/resources`
- **Method:** `GET`
- **Status:** `[IMPLEMENTED]`
- **Description:** Returns granular tracking data for every physical and human asset (individual beds, surgical suites, staff rosters, ambulances, and blood types).
- **Request Body:** None

#### Success Response (200 OK)
```json
{
  "summary": {
    "total_beds": 30,
    "available_beds": 16,
    "total_operating_rooms": 5,
    "open_operating_rooms": 2,
    "total_staff_on_duty": 24,
    "total_ambulances_available": 5,
    "total_blood_units": 30
  },
  "beds": [
    {
      "id": "bed-ed-01",
      "bed_code": "ED-01",
      "bed_type": "EMERGENCY",
      "department": "Emergency Department",
      "is_occupied": false,
      "is_reserved": false
    }
  ],
  "operating_rooms": [
    {
      "id": "or-01",
      "room_number": "OR-1",
      "status": "OPEN",
      "scheduled_procedure": null,
      "is_emergency_cleared": true
    },
    {
      "id": "or-03",
      "room_number": "OR-3",
      "status": "IN_USE",
      "scheduled_procedure": "Elective Arthroscopic Knee Debridement",
      "is_emergency_cleared": false
    }
  ],
  "staff": [
    {
      "id": "staff-doc-01",
      "name": "Dr. Marcus Chen",
      "role": "TRAUMA_SURGEON",
      "department": "Emergency Department",
      "is_on_duty": true,
      "is_assigned": false
    }
  ],
  "ambulances": [
    {
      "id": "amb-01",
      "vehicle_code": "MEDIC-01",
      "status": "AVAILABLE",
      "crew_assigned": true
    }
  ],
  "blood_inventory": [
    {
      "id": "blood-o_neg",
      "blood_type": "O_NEG",
      "units_available": 18,
      "minimum_threshold": 10
    }
  ],
  "last_updated": "2026-09-26T12:00:00.000000Z"
}
```

---

### 2.4 Create / Report Emergency Incident

- **Endpoint:** `/api/incidents`
- **Method:** `POST`
- **Status:** `[IMPLEMENTED]`
- **Description:** Reports a new incoming mass-casualty incident. Persists the record to the database and automatically writes an audit event.
- **Request Headers:** `Content-Type: application/json`

#### Request Body
```json
{
  "title": "Highway Interstate 95 Multi-Vehicle Transit Collision",
  "incident_type": "MASS_CASUALTY_COLLISION",
  "severity": "CRITICAL",
  "casualty_count": 42,
  "location": "Mile Marker 48 Southbound",
  "eta_minutes": 25,
  "description": "Charter bus and multiple passenger vehicles involved. Heavy entrapment."
}
```

#### Field Validation Rules
| Field | Type | Required | Constraints |
| :--- | :--- | :---: | :--- |
| `title` | string | Yes | 3 to 120 characters |
| `incident_type` | enum | Yes | `MASS_CASUALTY_COLLISION`, `TRANSIT_ACCIDENT`, `STRUCTURAL_COLLAPSE`, `HAZMAT`, `OTHER` |
| `severity` | enum | Yes | `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` (Default: `CRITICAL`) |
| `casualty_count` | integer | Yes | 1 to 1000 |
| `location` | string | Yes | 2 to 200 characters |
| `eta_minutes` | integer | Yes | 0 to 1440 minutes |
| `description` | string | No | Max 1000 characters |

#### Success Response (201 Created)
```json
{
  "id": "INC-7A8B9C0D",
  "title": "Highway Interstate 95 Multi-Vehicle Transit Collision",
  "incident_type": "MASS_CASUALTY_COLLISION",
  "severity": "CRITICAL",
  "casualty_count": 42,
  "location": "Mile Marker 48 Southbound",
  "eta_minutes": 25,
  "description": "Charter bus and multiple passenger vehicles involved. Heavy entrapment.",
  "status": "REPORTED",
  "created_at": "2026-09-26T12:05:00.000000Z",
  "updated_at": "2026-09-26T12:05:00.000000Z"
}
```

#### Error Response (422 Unprocessable Entity - Validation Failure)
```json
{
  "detail": "Request validation failed",
  "errors": [
    {
      "field": "body -> casualty_count",
      "message": "Input should be greater than or equal to 1",
      "type": "greater_than_equal"
    }
  ]
}
```

---

### 2.5 List Emergency Incidents

- **Endpoint:** `/api/incidents`
- **Method:** `GET`
- **Status:** `[IMPLEMENTED]`
- **Description:** Returns all tracked incidents ordered with the most recent first.
- **Request Body:** None

#### Success Response (200 OK)
```json
[
  {
    "id": "INC-7A8B9C0D",
    "title": "Highway Interstate 95 Multi-Vehicle Transit Collision",
    "incident_type": "MASS_CASUALTY_COLLISION",
    "severity": "CRITICAL",
    "casualty_count": 42,
    "location": "Mile Marker 48 Southbound",
    "eta_minutes": 25,
    "description": "Charter bus and multiple passenger vehicles involved. Heavy entrapment.",
    "status": "REPORTED",
    "created_at": "2026-09-26T12:05:00.000000Z",
    "updated_at": "2026-09-26T12:05:00.000000Z"
  }
]
```

---

### 2.6 Audit Trail Log

- **Endpoint:** `/api/audit-log`
- **Method:** `GET`
- **Status:** `[IMPLEMENTED]`
- **Query Parameters:**
  - `limit` (optional, default: `50`, max: `200`)
- **Description:** Chronological log of system initializations, incident reports, tool actions, and human approvals.

#### Success Response (200 OK)
```json
[
  {
    "id": "7f09a12c-5678-4321-9abc-def012345678",
    "incident_id": "INC-7A8B9C0D",
    "event_type": "INCIDENT_REPORTED",
    "action_name": "INGEST_EMERGENCY_DISPATCH",
    "tier": "GREEN",
    "details": {
      "title": "Highway Interstate 95 Multi-Vehicle Transit Collision",
      "incident_type": "MASS_CASUALTY_COLLISION",
      "severity": "CRITICAL",
      "casualty_count": 42,
      "location": "Mile Marker 48 Southbound",
      "eta_minutes": 25
    },
    "performed_by": "DISPATCH_RECEIVER",
    "timestamp": "2026-09-26T12:05:00.000000Z"
  },
  {
    "id": "3b12c45d-1234-5678-9abc-0123456789ab",
    "incident_id": null,
    "event_type": "SYSTEM_INITIALIZED",
    "action_name": "SEED_BASELINE_CAPACITY",
    "tier": "GREEN",
    "details": {
      "message": "Hospital operational synthetic capacity baseline initialized.",
      "emergency_beds": 12,
      "icu_beds": 4,
      "open_ors": 2,
      "doctors": 8,
      "nurses": 16,
      "ambulances": 5,
      "blood_units": 30
    },
    "performed_by": "SYSTEM",
    "timestamp": "2026-09-26T12:00:00.000000Z"
  }
]
```

---

## 3. Human Approval & Runbook Endpoints `[IMPLEMENTED - PHASE 4 & 5]`

### 3.1 Initiate MCI-01 Emergency Runbook `[IMPLEMENTED]`

- **Endpoint:** `/api/runbooks/mci/start`
- **Method:** `POST`
- **Status:** `[IMPLEMENTED]`
- **Description:** Initiates the 15-step MCI-01 Mass Casualty Incident operational runbook. Automated steps execute sequentially until reaching the consequential Step 10 TrueForge checkpoint.

#### Request Body
```json
{
  "incident_id": "INC-MCI-42",
  "incoming_casualties": 42,
  "acute_ratio": 0.5
}
```

#### Response (201 Created)
```json
{
  "runbook_execution_id": "RBX-D736A471",
  "runbook_id": "MCI-01",
  "incident_id": "INC-MCI-42",
  "state": "WAITING_FOR_APPROVAL",
  "current_step": "MCI-01-10",
  "checkpoint_id": "CHK-4E728E62",
  "message": "Runbook initiated. Current state: WAITING_FOR_APPROVAL at step MCI-01-10."
}
```

---

### 3.2 Human Approval Checkpoint Decision `[IMPLEMENTED]`

- **Endpoint:** `/api/approval/decide`
- **Method:** `POST`
- **Status:** `[IMPLEMENTED]`
- **Description:** Human operator submits authorization (`allow` / `deny` / `APPROVE` / `REJECT`) for a consequential (RED) action.

#### Request Body
```json
{
  "checkpoint_id": "CHK-4E728E62",
  "decision": "APPROVE",
  "decision_by": "Dr. Eleanor Vance, Trauma Medical Director",
  "reason": "Surge preemption authorized. Elective surgery safely postponed.",
  "execute_if_approved": true
}
```

#### Response (200 OK)
```json
{
  "status": "DECIDED",
  "checkpoint": {
    "checkpoint_id": "CHK-4E728E62",
    "state": "EXECUTED",
    "token_consumed": true
  },
  "execution": {
    "status": "SUCCESS",
    "resource": "OR-3",
    "decision": "APPROVED",
    "authorized_by": "Dr. Eleanor Vance, Trauma Medical Director",
    "verification": {
      "verified": true,
      "actual_value": "RESERVED_FOR_TRAUMA"
    },
    "audit_recorded": true
  }
}
```

---

### 3.3 Resume Paused Runbook `[IMPLEMENTED]`

- **Endpoint:** `/api/runbooks/{execution_id}/resume`
- **Method:** `POST`
- **Status:** `[IMPLEMENTED]`
- **Description:** Resumes a runbook paused at a TrueForge checkpoint once the human decision has been registered.

#### Response (200 OK)
```json
{
  "execution_id": "RBX-D736A471",
  "runbook_id": "MCI-01",
  "incident_id": "INC-MCI-42",
  "state": "COMPLETED",
  "completed_steps": ["MCI-01-01", "...", "MCI-01-15"],
  "summary": {
    "total_steps": 15,
    "completed_steps": 15,
    "preempted_operating_rooms": ["OR-3"]
  }
}
```

---

### 3.4 Query Runbook State & History `[IMPLEMENTED]`

- **Endpoints:**
  - `GET /api/runbooks/{execution_id}` — Query specific execution state and completed step results.
  - `GET /api/runbooks/latest` — Query the most recent execution (used by UI for state recovery on browser refresh).
  - `GET /api/runbooks?limit=10` — List recent executions.
- **Status:** `[IMPLEMENTED]`

