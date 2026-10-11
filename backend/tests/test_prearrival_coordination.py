"""Comprehensive test suite for AI Emergency Pre-Arrival Coordination & Resource Matching."""
import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.models.prearrival import EmergencyPriority, VitalsSchema
from backend.app.services.database import AuditEventRecord, PreArrivalCaseRecord, SessionLocal, init_db
from backend.app.services.prearrival_engine import (
    classify_emergency_case,
    extract_clinical_facts_from_text,
    generate_explainable_recommendations,
)

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_test_db():
    """Ensure database schema is initialized before running tests."""
    init_db()
    yield


def test_natural_language_extraction_flagship_scenario():
    """Verify clinical fact extraction from the 28yo male road traffic accident description."""
    raw_text = (
        "28 year old male involved in a road traffic accident. "
        "Severe bleeding from left leg. "
        "BP 90/60. Heart rate 118. SpO2 88%. "
        "Patient is conscious but confused. Possible fracture. "
        "Blood group unknown."
    )
    facts = extract_clinical_facts_from_text(raw_text)

    assert facts["age"] == 28
    assert facts["gender"] == "Male"
    assert facts["extracted_vitals"]["bp"] == "90/60"
    assert facts["extracted_vitals"]["hr"] == 118
    assert facts["extracted_vitals"]["spo2"] == 88
    assert facts["blood_group"] == "UNKNOWN"

    symptoms = " ".join(facts["extracted_symptoms"]).lower()
    assert "hypotension" in symptoms
    assert "tachycardia" in symptoms
    assert "hypoxemia" in symptoms
    assert "hemorrhage" in symptoms or "bleeding" in symptoms
    assert "fracture" in symptoms
    assert "confusion" in symptoms


def test_classify_emergency_case_trauma():
    """Verify trauma triage classification and CRITICAL priority due to hemodynamic compromise."""
    vitals = VitalsSchema(bp="90/60", hr=118, spo2=88)
    symptoms = ["Severe active hemorrhage", "Hypotension", "Possible skeletal fracture"]

    category, priority, summary = classify_emergency_case(
        symptoms=symptoms,
        vitals=vitals,
        incident_type="Road Traffic Accident",
    )

    assert category == "TRAUMA / SEVERE BLEEDING"
    assert priority == EmergencyPriority.CRITICAL
    assert "acute" in summary.lower() or "trauma" in summary.lower()


def test_classify_emergency_case_cardiac_and_stroke():
    """Verify cardiac and stroke classification rules."""
    # Cardiac
    cardiac_cat, cardiac_prio, _ = classify_emergency_case(
        symptoms=["Crushing substernal chest pain", "Diaphoresis"],
        vitals=VitalsSchema(bp="140/90", hr=95, spo2=97),
        incident_type="Cardiac Emergency",
    )
    assert cardiac_cat == "CARDIAC EMERGENCY"
    assert cardiac_prio in (EmergencyPriority.HIGH, EmergencyPriority.CRITICAL)

    # Stroke
    stroke_cat, stroke_prio, _ = classify_emergency_case(
        symptoms=["Right-sided facial droop", "Acute slurred speech"],
        vitals=VitalsSchema(bp="165/100", hr=82, spo2=98),
        incident_type="Suspected Stroke",
    )
    assert stroke_cat == "STROKE-LIKE SYMPTOMS"
    assert stroke_prio == EmergencyPriority.HIGH


def test_explainable_recommendations_have_clinical_rationales():
    """Verify every recommended resource has an explicit, clinically grounded rationale."""
    db = SessionLocal()
    try:
        vitals = VitalsSchema(bp="90/60", hr=118, spo2=88)
        symptoms = ["Severe active hemorrhage", "Hypotension", "Possible fracture"]
        recs, actions = generate_explainable_recommendations(
            category="TRAUMA / SEVERE BLEEDING",
            priority=EmergencyPriority.CRITICAL,
            vitals=vitals,
            symptoms=symptoms,
            incident_type="Road Traffic Accident",
            db=db,
        )

        assert len(recs) >= 6
        assert len(actions) >= 4

        # Validate that every single recommendation has a descriptive medical reason
        for r in recs:
            assert "reason" in r
            assert len(r["reason"]) > 20, f"Recommendation {r['resource_name']} lacks detailed rationale"
            assert r["hospital_availability"] in ("AVAILABLE", "LIMITED", "UNAVAILABLE", "PREPARING", "RESERVED")

        # Specific vital items must be present
        resource_names = " ".join(r["resource_name"] for r in recs)
        assert "Trauma Bay" in resource_names or "ED-01" in resource_names
        assert "Trauma Surgeon" in resource_names
        assert "Blood" in resource_names or "O-Negative" in resource_names
        assert "Rapid Infuser" in resource_names or "Normal Saline" in resource_names
        assert "Oxygen" in resource_names
        assert "CT Scan" in resource_names
        assert "Operating Room" in resource_names
    finally:
        db.close()


def test_create_prearrival_case_api():
    """Verify creating a pre-arrival case via the REST API endpoint."""
    payload = {
        "ambulance_id": "AMB-108",
        "raw_description": "54 year old female with acute chest pain and shortness of breath. BP 150/95. HR 105. SpO2 93%.",
        "current_location_name": "Outer Ring Road Exit 4",
        "distance_km": 12.5,
        "eta_minutes": 18,
    }

    response = client.post("/api/prearrival/cases", json=payload)
    assert response.status_code == 201

    data = response.json()
    assert data["ambulance_id"] == "AMB-108"
    assert data["patient_age"] == 54
    assert data["patient_gender"] == "Female"
    assert data["emergency_category"] == "CARDIAC EMERGENCY"
    assert data["eta_minutes"] == 18
    assert len(data["actions"]) > 0
    assert len(data["immediate_actions"]) > 0


def test_human_in_the_loop_approval_workflow():
    """Verify authorized clinician can APPROVE or REJECT specific preparation actions."""
    # 1. Seed demo case
    seed_res = client.post("/api/prearrival/demo-seed")
    assert seed_res.status_code == 200
    case_data = seed_res.json()
    case_id = case_data["id"]

    # Find the blood preparation action
    blood_action = next((a for a in case_data["actions"] if "Blood" in a["resource_name"]), None)
    assert blood_action is not None, "Blood action must exist in trauma plan"
    action_id = blood_action["id"]
    assert blood_action["decision_type"] == "PENDING"

    # 2. Authorize action
    decision_payload = {
        "decision": "APPROVE",
        "authorized_by": "Dr. Sarah Vance, Trauma Director",
        "reason": "Emergency pre-transfusion authorized for severe hemorrhage with shock index > 1.0.",
    }
    dec_res = client.post(f"/api/prearrival/cases/{case_id}/actions/{action_id}/decision", json=decision_payload)
    assert dec_res.status_code == 200

    updated_action = dec_res.json()
    assert updated_action["decision_type"] == "APPROVED"
    assert updated_action["decision_by"] == "Dr. Sarah Vance, Trauma Director"
    assert updated_action["hospital_availability"] == "RESERVED"

    # 3. Verify audit log captured the human decision
    db = SessionLocal()
    try:
        audit = db.query(AuditEventRecord).filter(
            AuditEventRecord.incident_id == case_id,
            AuditEventRecord.event_type == "PREARRIVAL_ACTION_APPROVED",
        ).first()
        assert audit is not None
        assert audit.performed_by == "Dr. Sarah Vance, Trauma Director"
    finally:
        db.close()


def test_human_in_the_loop_rejection_workflow():
    """Verify clinician can REJECT a proposed resource reservation with logged rationale."""
    seed_res = client.post("/api/prearrival/demo-seed")
    case_id = seed_res.json()["id"]

    or_action = next((a for a in seed_res.json()["actions"] if "Operating Room" in a["resource_name"]), None)
    assert or_action is not None

    decision_payload = {
        "decision": "REJECT",
        "authorized_by": "Dr. Marcus Chen",
        "reason": "Elective surgery in OR-3 near completion; hold OR-2 open instead.",
    }
    dec_res = client.post(f"/api/prearrival/cases/{case_id}/actions/{or_action['id']}/decision", json=decision_payload)
    assert dec_res.status_code == 200

    updated_action = dec_res.json()
    assert updated_action["decision_type"] == "REJECTED"
    assert updated_action["hospital_availability"] == "UNAVAILABLE"


def test_location_update_and_arrival_transition():
    """Verify updating ambulance distance/ETA and transitioning to ARRIVED when ETA reaches 0."""
    seed_res = client.post("/api/prearrival/demo-seed")
    case_id = seed_res.json()["id"]

    # 1. Update location en route
    loc_payload = {
        "current_location_name": "Yeshwanthpur Junction",
        "distance_km": 3.2,
        "eta_minutes": 5,
    }
    loc_res = client.post(f"/api/prearrival/cases/{case_id}/location", json=loc_payload)
    assert loc_res.status_code == 200
    assert loc_res.json()["eta_minutes"] == 5
    assert loc_res.json()["status"] == "EN_ROUTE"

    # 2. Trigger arrival via /arrive endpoint
    arr_res = client.post(f"/api/prearrival/cases/{case_id}/arrive")
    assert arr_res.status_code == 200
    arrived_case = arr_res.json()
    assert arrived_case["status"] == "ARRIVED"
    assert arrived_case["eta_minutes"] == 0
    assert arrived_case["arrived_at"] is not None


def test_hospital_resources_overview_demo_data():
    """Verify hospital resources endpoint correctly marks data as Demo Hospital Data."""
    res = client.get("/api/prearrival/resources")
    assert res.status_code == 200

    data = res.json()
    assert data["source"] == "Demo Hospital Data"
    assert "emergency_beds" in data
    assert "icu_beds" in data
    assert "operating_rooms" in data
    assert "blood_inventory" in data
    assert "trauma_surgeons" in data
    assert "scanners_and_equipment" in data
