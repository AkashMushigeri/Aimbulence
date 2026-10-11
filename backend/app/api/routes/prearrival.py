"""Emergency Pre-Arrival Coordination REST API Endpoints.

Enables ambulance paramedics to transmit en-route patient clinical summaries and vitals,
generates explainable AI preparation plans, and provides authorized hospital clinicians
with human-in-the-loop acknowledgement and resource approval controls.
"""
import json
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.models.prearrival import (
    ActionDecision,
    ActionDecisionRequest,
    HospitalAvailability,
    LocationUpdateRequest,
    PreArrivalActionResponse,
    PreArrivalCaseCreate,
    PreArrivalCaseResponse,
    VitalsSchema,
)
from backend.app.services.database import (
    AuditEventRecord,
    BedRecord,
    BloodInventoryRecord,
    DepartmentRecord,
    OperatingRoomRecord,
    PreArrivalActionRecord,
    PreArrivalCaseRecord,
    StaffRecord,
    get_db,
)
from backend.app.services.prearrival_engine import (
    process_and_create_prearrival_case,
)

router = APIRouter(prefix="/prearrival", tags=["Pre-Arrival Emergency Coordination"])


def _serialize_case(case: PreArrivalCaseRecord) -> PreArrivalCaseResponse:
    """Helper to convert ORM PreArrivalCaseRecord to Pydantic PreArrivalCaseResponse."""
    symptoms = []
    if case.symptoms_json:
        try:
            symptoms = json.loads(case.symptoms_json)
        except Exception:
            symptoms = [case.symptoms_json]

    actions_list = [
        PreArrivalActionResponse(
            id=a.id,
            case_id=a.case_id,
            resource_category=a.resource_category,
            resource_name=a.resource_name,
            recommended_status=a.recommended_status,
            reason=a.reason,
            hospital_availability=a.hospital_availability,
            decision_type=a.decision_type,
            decision_by=a.decision_by,
            decision_reason=a.decision_reason,
            decision_timestamp=a.decision_timestamp,
            requires_approval=a.requires_approval,
            created_at=a.created_at,
        )
        for a in (case.actions or [])
    ]

    immediate_actions = []
    if case.immediate_actions_json:
        try:
            immediate_actions = json.loads(case.immediate_actions_json)
        except Exception:
            immediate_actions = []

    return PreArrivalCaseResponse(
        id=case.id,
        ambulance_id=case.ambulance_id,
        patient_name=case.patient_name,
        patient_age=case.patient_age,
        patient_gender=case.patient_gender,
        symptoms=symptoms,
        vitals=VitalsSchema(
            bp=case.vital_bp,
            hr=case.vital_hr,
            spo2=case.vital_spo2,
            temp=case.vital_temp,
            rr=case.vital_rr,
        ),
        allergies=case.allergies,
        medical_conditions=case.medical_conditions,
        current_medications=case.current_medications,
        incident_type=case.incident_type,
        consciousness=case.consciousness,
        blood_group=case.blood_group,
        oxygen_required=case.oxygen_required,
        pain_level=case.pain_level,
        raw_description=case.raw_description,
        emergency_category=case.emergency_category,
        priority=case.priority,
        clinical_summary=case.clinical_summary or "",
        current_location_name=case.current_location_name,
        destination_hospital=case.destination_hospital,
        distance_km=case.distance_km,
        eta_minutes=case.eta_minutes,
        latitude=case.latitude,
        longitude=case.longitude,
        status=case.status,
        immediate_actions=immediate_actions,
        actions=actions_list,
        created_at=case.created_at,
        updated_at=case.updated_at,
        arrived_at=case.arrived_at,
    )


@router.post("/cases", response_model=PreArrivalCaseResponse, status_code=status.HTTP_201_CREATED, summary="Create en-route ambulance emergency case")
def create_case(payload: PreArrivalCaseCreate, db: Session = Depends(get_db)):
    """Receives ambulance pre-arrival information, extracts clinical facts, and generates preparation plan."""
    case = process_and_create_prearrival_case(payload=payload, db=db)
    return _serialize_case(case)


@router.get("/cases", response_model=List[PreArrivalCaseResponse], summary="List active incoming ambulance emergencies")
def list_cases(db: Session = Depends(get_db)):
    """Returns all active pre-arrival cases ordered by urgency priority and ETA."""
    cases = db.query(PreArrivalCaseRecord).order_by(
        PreArrivalCaseRecord.status.asc(),
        PreArrivalCaseRecord.created_at.desc(),
    ).all()
    return [_serialize_case(c) for c in cases]


@router.get("/cases/{case_id}", response_model=PreArrivalCaseResponse, summary="Get pre-arrival case details and preparation plan")
def get_case(case_id: str, db: Session = Depends(get_db)):
    """Fetches comprehensive pre-arrival plan, extracted facts, vitals, and preparation recommendations."""
    case = db.query(PreArrivalCaseRecord).filter(PreArrivalCaseRecord.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail=f"Pre-arrival case '{case_id}' not found.")
    return _serialize_case(case)


@router.post("/cases/{case_id}/actions/{action_id}/decision", response_model=PreArrivalActionResponse, summary="Authorize or acknowledge preparation action")
def record_action_decision(
    case_id: str,
    action_id: str,
    payload: ActionDecisionRequest,
    db: Session = Depends(get_db),
):
    """Authorized clinician human-in-the-loop checkpoint: APPROVE, REJECT, or ACKNOWLEDGE a preparation action."""
    action = db.query(PreArrivalActionRecord).filter(
        PreArrivalActionRecord.id == action_id,
        PreArrivalActionRecord.case_id == case_id,
    ).first()
    if not action:
        raise HTTPException(status_code=404, detail=f"Action '{action_id}' for case '{case_id}' not found.")

    now = datetime.now(timezone.utc)
    raw_dec = payload.decision.value
    if raw_dec in ("APPROVE", "APPROVED"):
        norm_dec = ActionDecision.APPROVED.value
    elif raw_dec in ("REJECT", "REJECTED"):
        norm_dec = ActionDecision.REJECTED.value
    else:
        norm_dec = ActionDecision.ACKNOWLEDGED.value

    action.decision_type = norm_dec
    action.decision_by = payload.authorized_by
    action.decision_reason = payload.reason
    action.decision_timestamp = now

    # Update resource state when approved
    if norm_dec == ActionDecision.APPROVED.value:
        if "Bay" in action.resource_name or "Bed" in action.resource_name:
            action.hospital_availability = HospitalAvailability.RESERVED.value
            # Reserve first available emergency bed in database
            bed = db.query(BedRecord).filter(
                BedRecord.bed_type == "EMERGENCY",
                BedRecord.is_occupied == False,
                BedRecord.is_reserved == False,
            ).first()
            if bed:
                bed.is_reserved = True
        elif "Operating Room" in action.resource_name:
            action.hospital_availability = HospitalAvailability.PREPARING.value
        elif "Blood" in action.resource_name:
            action.hospital_availability = HospitalAvailability.RESERVED.value
        else:
            action.hospital_availability = HospitalAvailability.PREPARING.value
    elif norm_dec == ActionDecision.REJECTED.value:
        action.hospital_availability = HospitalAvailability.UNAVAILABLE.value
    elif norm_dec == ActionDecision.ACKNOWLEDGED.value:
        action.hospital_availability = HospitalAvailability.PREPARING.value

    # Immutable Audit Log
    audit = AuditEventRecord(
        incident_id=case_id,
        event_type=f"PREARRIVAL_ACTION_{norm_dec}",
        action_name=action.resource_name,
        tier="RED" if action.requires_approval else "GREEN",
        details_json=json.dumps({
            "action_id": action.id,
            "resource_category": action.resource_category,
            "decision": norm_dec,
            "authorized_by": payload.authorized_by,
            "reason": payload.reason,
            "resulting_availability": action.hospital_availability,
        }),
        performed_by=payload.authorized_by,
        timestamp=now,
    )
    db.add(audit)
    db.commit()
    db.refresh(action)

    return PreArrivalActionResponse(
        id=action.id,
        case_id=action.case_id,
        resource_category=action.resource_category,
        resource_name=action.resource_name,
        recommended_status=action.recommended_status,
        reason=action.reason,
        hospital_availability=action.hospital_availability,
        decision_type=action.decision_type,
        decision_by=action.decision_by,
        decision_reason=action.decision_reason,
        decision_timestamp=action.decision_timestamp,
        requires_approval=action.requires_approval,
        created_at=action.created_at,
    )


@router.post("/cases/{case_id}/location", response_model=PreArrivalCaseResponse, summary="Update ambulance GPS telemetry and ETA")
def update_location(
    case_id: str,
    payload: LocationUpdateRequest,
    db: Session = Depends(get_db),
):
    """Updates the simulated or live GPS telemetry and ETA countdown for an en-route ambulance."""
    case = db.query(PreArrivalCaseRecord).filter(PreArrivalCaseRecord.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail=f"Case '{case_id}' not found.")

    now = datetime.now(timezone.utc)
    if payload.current_location_name is not None:
        case.current_location_name = payload.current_location_name
    if payload.distance_km is not None:
        case.distance_km = payload.distance_km
    if payload.latitude is not None:
        case.latitude = payload.latitude
    if payload.longitude is not None:
        case.longitude = payload.longitude

    if payload.eta_minutes is not None:
        case.eta_minutes = payload.eta_minutes
        if payload.eta_minutes <= 0 and case.status != "ARRIVED":
            case.status = "ARRIVED"
            case.arrived_at = now
            # Log arrival audit
            db.add(AuditEventRecord(
                incident_id=case.id,
                event_type="AMBULANCE_ARRIVED",
                action_name="PATIENT_TOUCHDOWN",
                tier="GREEN",
                details_json=json.dumps({"ambulance_id": case.ambulance_id, "message": "Ambulance arrived at emergency bay."}),
                performed_by="DISPATCH_RECEIVER",
                timestamp=now,
            ))

    case.updated_at = now
    db.commit()
    db.refresh(case)
    return _serialize_case(case)


@router.post("/cases/{case_id}/arrive", response_model=PreArrivalCaseResponse, summary="Mark ambulance as arrived at hospital")
def mark_arrived(case_id: str, db: Session = Depends(get_db)):
    """Transitions ambulance status to ARRIVED upon arrival at the trauma resuscitation bay."""
    case = db.query(PreArrivalCaseRecord).filter(PreArrivalCaseRecord.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail=f"Case '{case_id}' not found.")

    now = datetime.now(timezone.utc)
    case.status = "ARRIVED"
    case.eta_minutes = 0
    case.distance_km = 0.0
    case.arrived_at = now
    case.updated_at = now

    audit = AuditEventRecord(
        incident_id=case.id,
        event_type="AMBULANCE_ARRIVED",
        action_name="PATIENT_TOUCHDOWN",
        tier="GREEN",
        details_json=json.dumps({"ambulance_id": case.ambulance_id, "message": "Ambulance arrived at emergency bay."}),
        performed_by="DISPATCH_RECEIVER",
        timestamp=now,
    )
    db.add(audit)
    db.commit()
    db.refresh(case)
    return _serialize_case(case)


@router.get("/resources", summary="Get comprehensive hospital resource availability matrix")
def get_hospital_resources_overview(db: Session = Depends(get_db)):
    """Returns real-time capacity and preparation status of hospital departments, beds, blood, and equipment."""
    ed_total = db.query(BedRecord).filter(BedRecord.bed_type == "EMERGENCY").count()
    ed_avail = db.query(BedRecord).filter(BedRecord.bed_type == "EMERGENCY", BedRecord.is_occupied == False, BedRecord.is_reserved == False).count()
    ed_reserved = db.query(BedRecord).filter(BedRecord.bed_type == "EMERGENCY", BedRecord.is_reserved == True).count()

    icu_total = db.query(BedRecord).filter(BedRecord.bed_type == "ICU").count()
    icu_avail = db.query(BedRecord).filter(BedRecord.bed_type == "ICU", BedRecord.is_occupied == False, BedRecord.is_reserved == False).count()
    icu_reserved = db.query(BedRecord).filter(BedRecord.bed_type == "ICU", BedRecord.is_reserved == True).count()

    ors = db.query(OperatingRoomRecord).all()
    blood = db.query(BloodInventoryRecord).all()
    surgeons = db.query(StaffRecord).filter(StaffRecord.role == "TRAUMA_SURGEON").all()

    return {
        "source": "Demo Hospital Data",
        "hospital_name": "Metro Central Trauma Hospital",
        "emergency_beds": {
            "total": ed_total,
            "available": ed_avail,
            "reserved": ed_reserved,
            "status": "AVAILABLE" if ed_avail >= 2 else ("LIMITED" if ed_avail == 1 else "UNAVAILABLE"),
        },
        "icu_beds": {
            "total": icu_total,
            "available": icu_avail,
            "reserved": icu_reserved,
            "status": "AVAILABLE" if icu_avail >= 2 else ("LIMITED" if icu_avail == 1 else "UNAVAILABLE"),
        },
        "operating_rooms": [
            {
                "room": r.room_number,
                "status": r.status,
                "procedure": r.scheduled_procedure or "None (Ready)",
                "emergency_cleared": r.is_emergency_cleared,
            }
            for r in ors
        ],
        "blood_inventory": [
            {
                "type": b.blood_type,
                "units_available": b.units_available,
                "minimum_threshold": b.minimum_threshold,
                "status": "AVAILABLE" if b.units_available >= b.minimum_threshold else "LIMITED",
            }
            for b in blood
        ],
        "trauma_surgeons": [
            {"name": s.name, "department": s.department, "status": "ON_DUTY" if s.is_on_duty else "ON_CALL"}
            for s in surgeons
        ],
        "scanners_and_equipment": [
            {"equipment": "CT Scanner (Trauma Pan-Scan)", "location": "Radiology Suite 1", "status": "AVAILABLE"},
            {"equipment": "MRI Scanner 3.0T", "location": "Radiology Suite 2", "status": "AVAILABLE"},
            {"equipment": "Belmont Rapid Blood Infuser", "location": "Trauma Bay ED-01", "status": "AVAILABLE"},
            {"equipment": "Zoll Biphasic Defibrillator", "location": "Trauma Bay ED-01", "status": "AVAILABLE"},
            {"equipment": "Hamilton T1 Transport Ventilator", "location": "Resuscitation Unit", "status": "AVAILABLE"},
        ],
    }


@router.post("/demo-seed", response_model=PreArrivalCaseResponse, summary="Seed the flagship 28yo male RTA demo scenario")
def seed_demo_scenario(db: Session = Depends(get_db)):
    """Seeds the standard hackathon demo scenario (28yo male road traffic accident, 14 min ETA)."""
    # Clear previous prearrival cases for clean demo
    db.query(PreArrivalActionRecord).delete()
    db.query(PreArrivalCaseRecord).delete()
    db.commit()

    demo_create = PreArrivalCaseCreate(
        ambulance_id="AMB-102",
        raw_description=(
            "28 year old male involved in a road traffic accident. "
            "Severe bleeding from left leg. "
            "BP 90/60. Heart rate 118. SpO2 88%. "
            "Patient is conscious but confused. Possible fracture. "
            "Blood group unknown."
        ),
        patient_name="Alex Turner",
        patient_age=28,
        patient_gender="Male",
        symptoms=["Severe bleeding from left leg", "Hypotension", "Tachycardia", "Hypoxemia", "Confusion", "Possible fracture"],
        vitals=VitalsSchema(bp="90/60", hr=118, spo2=88, temp="98.4 F", rr=24),
        allergies="None known (NKDA)",
        medical_conditions="No chronic medical conditions reported",
        current_medications="None",
        incident_type="Road Traffic Accident (High-Speed Vehicle Collision)",
        consciousness="Conscious but confused (GCS 13)",
        blood_group="Unknown",
        oxygen_required=True,
        pain_level="Severe (8/10)",
        current_location_name="Tumakuru Road, Mile 8",
        destination_hospital="Metro Central Trauma Hospital",
        distance_km=8.4,
        eta_minutes=14,
        latitude=13.0489,
        longitude=77.5147,
    )

    case = process_and_create_prearrival_case(payload=demo_create, db=db)
    return _serialize_case(case)
