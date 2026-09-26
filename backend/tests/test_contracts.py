"""Contract and persistence tests for AIMBULENCE Phase 1 backend."""
import os
import tempfile
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.app.main import app
from backend.app.services.database import Base, get_db, init_db, IncidentRecord, HospitalRecord


@pytest.fixture(scope="session")
def persistent_test_db():
    """Create a temporary persistent SQLite database file that survives across session connections."""
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp_file:
        db_path = tmp_file.name

    test_db_url = f"sqlite:///{db_path}"
    test_engine = create_engine(test_db_url, connect_args={"check_same_thread": False})
    
    # Initialize schema and seed baseline
    init_db(engine_instance=test_engine)
    
    yield test_engine, db_path

    # Cleanup after test suite
    test_engine.dispose()
    if os.path.exists(db_path):
        try:
            os.remove(db_path)
        except Exception:
            pass


@pytest.fixture
def client(persistent_test_db):
    """TestClient wired to the persistent SQLite test database."""
    test_engine, _ = persistent_test_db
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


# ==============================================================================
# 1. HEALTH ENDPOINT TEST
# ==============================================================================
def test_health_endpoint(client):
    """Verify /api/health returns 200 OK and confirms database connectivity."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "aimbulence-backend"
    assert data["database"] == "connected"
    assert "timestamp" in data


# ==============================================================================
# 2. HOSPITAL STATUS CONTRACT TEST
# ==============================================================================
def test_hospital_status_contract(client):
    """Verify /api/hospital/status reflects seeded deterministic capacity."""
    response = client.get("/api/hospital/status")
    assert response.status_code == 200
    data = response.json()
    
    assert data["hospital_name"] == "Metro Central Trauma Hospital"
    assert data["operational_code"] == "NORMAL"
    assert data["emergency_beds_available"] == 12
    assert data["emergency_beds_total"] == 20
    assert data["icu_beds_available"] == 4
    assert data["icu_beds_total"] == 10
    assert data["operating_rooms_available"] == 2
    assert data["operating_rooms_total"] == 5
    assert data["doctors_available"] == 8
    assert data["nurses_available"] == 16
    assert data["ambulances_available"] == 5
    assert data["blood_units_available"] == 30
    assert len(data["departments"]) >= 4


# ==============================================================================
# 3. RESOURCE INVENTORY TEST
# ==============================================================================
def test_resource_inventory_contract(client):
    """Verify /api/resources returns granular tracking records for all assets."""
    response = client.get("/api/resources")
    assert response.status_code == 200
    data = response.json()

    assert "summary" in data
    assert data["summary"]["total_beds"] == 30
    assert data["summary"]["available_beds"] == 16  # 12 ED + 4 ICU
    assert data["summary"]["open_operating_rooms"] == 2
    assert data["summary"]["total_blood_units"] == 30

    assert len(data["beds"]) == 30
    assert len(data["operating_rooms"]) == 5
    assert len(data["staff"]) == 24  # 8 doctors + 16 nurses
    assert len(data["ambulances"]) == 5
    assert len(data["blood_inventory"]) == 4


# ==============================================================================
# 4. VALID INCIDENT CREATION TEST
# ==============================================================================
def test_valid_incident_creation(client):
    """Verify reporting a valid 42-casualty mass casualty incident persists and returns 201."""
    payload = {
        "title": "Highway Interstate 95 Multi-Vehicle Transit Collision",
        "incident_type": "MASS_CASUALTY_COLLISION",
        "severity": "CRITICAL",
        "casualty_count": 42,
        "location": "Mile Marker 48 Southbound",
        "eta_minutes": 25,
        "description": "Charter bus and multiple passenger vehicles involved. Heavy entrapment.",
    }
    response = client.post("/api/incidents", json=payload)
    assert response.status_code == 201
    data = response.json()

    assert data["id"].startswith("INC-")
    assert data["title"] == payload["title"]
    assert data["casualty_count"] == 42
    assert data["status"] == "REPORTED"
    assert data["eta_minutes"] == 25

    # Verify queryable in /api/incidents
    list_response = client.get("/api/incidents")
    assert list_response.status_code == 200
    incident_ids = [inc["id"] for inc in list_response.json()]
    assert data["id"] in incident_ids


# ==============================================================================
# 5. INVALID INCIDENT REJECTION TEST
# ==============================================================================
def test_invalid_incident_rejection(client):
    """Verify invalid incident payloads (e.g. negative casualty count, missing title) are rejected with 422."""
    # Case A: Negative casualty count
    bad_payload_1 = {
        "title": "Invalid Incident",
        "incident_type": "MASS_CASUALTY_COLLISION",
        "severity": "CRITICAL",
        "casualty_count": -5,  # Invalid: ge=1 constraint
        "location": "Route 9",
        "eta_minutes": 10,
    }
    response_1 = client.post("/api/incidents", json=bad_payload_1)
    assert response_1.status_code == 422
    data_1 = response_1.json()
    assert "detail" in data_1
    assert "casualty_count" in str(data_1)

    # Case B: Missing title and location
    bad_payload_2 = {
        "casualty_count": 20,
        "eta_minutes": 15,
    }
    response_2 = client.post("/api/incidents", json=bad_payload_2)
    assert response_2.status_code == 422


# ==============================================================================
# 6. AUDIT LOG TEST
# ==============================================================================
def test_audit_log_endpoint(client):
    """Verify /api/audit-log records events for baseline seed and incident creation."""
    response = client.get("/api/audit-log")
    assert response.status_code == 200
    events = response.json()
    assert len(events) >= 1
    
    event_types = [e["event_type"] for e in events]
    assert "SYSTEM_INITIALIZED" in event_types
    assert "INCIDENT_REPORTED" in event_types


# ==============================================================================
# 7. DATABASE PERSISTENCE ACROSS RE-INITIALIZATION / RESTART TEST
# ==============================================================================
def test_database_persistence_across_restart(persistent_test_db):
    """Verify that records committed to the SQLite database survive engine disconnect & process re-init."""
    test_engine, db_path = persistent_test_db
    
    # 1. First connection: write an incident directly into DB
    SessionA = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
    session_a = SessionA()
    test_incident_id = "INC-PERSIST-TEST-01"
    session_a.add(IncidentRecord(
        id=test_incident_id,
        title="Persistence Verification Incident",
        incident_type="MASS_CASUALTY_COLLISION",
        severity="HIGH",
        casualty_count=15,
        location="Sector 4 Bypass",
        eta_minutes=12,
        description="Created to verify process restart persistence",
        status="REPORTED",
    ))
    session_a.commit()
    session_a.close()

    # 2. Simulate process restart by disposing old engine and creating a brand new engine pointing to same db file
    test_engine.dispose()
    new_engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
    
    # Call init_db on new engine to verify it does not wipe existing data
    init_db(engine_instance=new_engine)

    # 3. Query through new session
    SessionB = sessionmaker(autocommit=False, autoflush=False, bind=new_engine)
    session_b = SessionB()
    persisted_record = session_b.query(IncidentRecord).filter(IncidentRecord.id == test_incident_id).first()
    
    assert persisted_record is not None, "Record failed to persist across simulated restart!"
    assert persisted_record.casualty_count == 15
    assert persisted_record.title == "Persistence Verification Incident"
    
    session_b.close()
    new_engine.dispose()
