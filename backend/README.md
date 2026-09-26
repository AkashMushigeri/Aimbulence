# AIMBULENCE — Backend Service & Foundation

This directory houses the backend service, persistent SQLite data layer, Pydantic schemas, and API routes for the **AIMBULENCE** emergency hospital operations runbook executor.

---

## Purpose
During Phase 1 (Foundation), the backend provides:
1. **Strongly Typed Schemas:** Pydantic models for incidents, hospital operational capacity, resources, actions, and audit logs.
2. **Persistent Synthetic Operational Database:** SQLite database holding seed data for the 42-casualty mass collision scenario (beds, ORs, staff, ambulances, blood inventory).
3. **Core REST API:** FastAPI endpoints enabling frontend integration and testing.
4. **Automated Contracts:** Pytest test suite validating schema boundaries and persistence.

---

## Local Setup & Development

### Prerequisites
- Python 3.11+
- Git

> [!IMPORTANT]
> **Node.js Environment Requirement for TrueForge:**  
> TrueForge CLI and runtime require **Node.js 22+**.  
> The current system environment has Node `20.20.2`. TrueForge installation and configuration are deferred to Phase 3 after Node is updated to v22+. No fake TrueForge SDKs or packages have been introduced.

### 1. Virtual Environment & Dependencies

From the repository root directory:

```bash
# Create virtual environment
python -m venv .venv

# Activate virtual environment
# Windows (PowerShell):
.\.venv\Scripts\Activate.ps1
# Linux / macOS:
# source .venv/bin/activate

# Install backend dependencies
pip install -r backend/requirements.txt
```

### 2. Configuration (.env)

Copy the environment template:
```bash
cp .env.example .env
```

Default local configuration:
- `DATABASE_URL=sqlite:///./hospital_operations.db`
- `APP_ENV=development`
- `HOST=0.0.0.0`
- `PORT=8000`

### 3. Database Initialization & Seeding

Database initialization is automatic upon application startup via the FastAPI `lifespan` handler.

To programmatically initialize the database:
```bash
python -c "from backend.app.services.database import init_db; init_db()"
```

Deterministic synthetic baseline:
- Emergency beds: 12 available (20 total)
- ICU beds: 4 available (10 total)
- Operating rooms: 2 available (5 total; 3 in elective procedures)
- Doctors: 8 on duty (including 3 trauma surgeons)
- Nurses: 16 on duty
- Ambulances: 5 available
- Blood units: 30 available (including 18 O-neg)

### 4. Running the FastAPI Server

```bash
uvicorn backend.app.main:app --reload --host 0.0.0.0 --port 8000
```
- Interactive Swagger documentation: [http://localhost:8000/docs](http://localhost:8000/docs)
- Interactive ReDoc documentation: [http://localhost:8000/redoc](http://localhost:8000/redoc)

### 5. Running the Test Suite

```bash
pytest
```
Or:
```bash
python -m pytest -v backend/tests
```

---

## Implemented API Endpoints (Phase 1)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/` | Service root and metadata |
| `GET` | `/api/health` | Health check and database connectivity verification |
| `GET` | `/api/hospital/status` | Aggregated hospital surge capacity and department metrics |
| `GET` | `/api/resources` | Granular inventory of beds, surgical suites, staff, ambulances, blood |
| `POST`| `/api/incidents` | Report a new emergency incident (e.g. 42 incoming casualties) |
| `GET` | `/api/incidents` | List all tracked emergency incidents |
| `GET` | `/api/audit-log` | Chronological operational audit trail |

---

## Architecture Note: Phase 3 Integration

In Phase 3, the AIMBULENCE agent harness will connect directly to this backend foundation:

```
                  EMERGENCY DISPATCH ALERT
                             │
                             ▼
                    [AIMBULENCE AGENT]
                             │
                             ▼
                        [TRUEFORGE]
              (Agent Harness & Checkpoint Gate)
                             │
                             ▼
                    [MCP / TOOL LAYER]
                             │
                             ▼
                [HOSPITAL OPERATIONAL TOOLS]
                             │
                             ▼
               [PERSISTENT SQLite DATABASE]
```

TrueForge will manage tool registration via the Model Context Protocol (MCP), enforce approval checkpoints for consequential RED actions, and maintain agent session state.
