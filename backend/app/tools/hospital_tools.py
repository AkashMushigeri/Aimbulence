"""Hospital-wide operational capacity and dynamic resource shortage calculation tools."""
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from sqlalchemy.orm import Session

from backend.app.services.database import (
    SessionLocal,
    HospitalRecord,
    DepartmentRecord,
    BedRecord,
    OperatingRoomRecord,
    StaffRecord,
    AmbulanceRecord,
    BloodInventoryRecord,
)
from backend.app.tools.exceptions import InvalidQuantityError, ResourceNotFoundError


def get_hospital_capacity(db: Optional[Session] = None) -> Dict[str, Any]:
    """Read current emergency operational capacity directly from the persistent database.
    
    Safety Classification: GREEN (Safe / Read-only)
    """
    should_close = False
    if db is None:
        db = SessionLocal()
        should_close = True

    try:
        hospital = db.query(HospitalRecord).first()
        if not hospital:
            raise ResourceNotFoundError("Hospital operational baseline record not found in database.")

        # Query beds
        ed_beds = db.query(BedRecord).filter(BedRecord.bed_type == "EMERGENCY").all()
        ed_total = len(ed_beds)
        ed_available = sum(1 for b in ed_beds if not b.is_occupied and not b.is_reserved)
        ed_occupied = sum(1 for b in ed_beds if b.is_occupied)
        ed_reserved = sum(1 for b in ed_beds if b.is_reserved)

        icu_beds = db.query(BedRecord).filter(BedRecord.bed_type == "ICU").all()
        icu_total = len(icu_beds)
        icu_available = sum(1 for b in icu_beds if not b.is_occupied and not b.is_reserved)
        icu_occupied = sum(1 for b in icu_beds if b.is_occupied)
        icu_reserved = sum(1 for b in icu_beds if b.is_reserved)

        # Query Operating Rooms
        ors = db.query(OperatingRoomRecord).all()
        or_total = len(ors)
        or_open = sum(1 for o in ors if o.status == "OPEN")
        or_in_use = sum(1 for o in ors if o.status == "IN_USE")
        or_reserved = sum(1 for o in ors if o.status == "RESERVED_FOR_TRAUMA")

        # Query Staff
        staff = db.query(StaffRecord).all()
        doctors_total = sum(1 for s in staff if s.role in ["DOCTOR", "TRAUMA_SURGEON", "ANESTHESIOLOGIST"] and s.is_on_duty)
        trauma_surgeons_available = sum(1 for s in staff if s.role == "TRAUMA_SURGEON" and s.is_on_duty and not s.is_assigned)
        anesthesiologists_available = sum(1 for s in staff if s.role == "ANESTHESIOLOGIST" and s.is_on_duty and not s.is_assigned)
        nurses_available = sum(1 for s in staff if s.role == "NURSE" and s.is_on_duty and not s.is_assigned)

        # Query Ambulances
        ambulances = db.query(AmbulanceRecord).all()
        amb_total = len(ambulances)
        amb_available = sum(1 for a in ambulances if a.status == "AVAILABLE")
        amb_dispatched = sum(1 for a in ambulances if a.status == "DISPATCHED")

        # Query Blood
        blood_records = db.query(BloodInventoryRecord).all()
        total_blood_units = sum(b.units_available for b in blood_records)
        o_neg_record = next((b for b in blood_records if b.blood_type == "O_NEG"), None)
        o_neg_units = o_neg_record.units_available if o_neg_record else 0

        now = datetime.now(timezone.utc)

        return {
            "status": "SUCCESS",
            "hospital_name": hospital.name,
            "operational_code": hospital.operational_code,
            "emergency_beds": {
                "total": ed_total,
                "available": ed_available,
                "occupied": ed_occupied,
                "reserved": ed_reserved,
            },
            "icu_beds": {
                "total": icu_total,
                "available": icu_available,
                "occupied": icu_occupied,
                "reserved": icu_reserved,
            },
            "operating_rooms": {
                "total": or_total,
                "open": or_open,
                "in_use": or_in_use,
                "reserved": or_reserved,
            },
            "staff": {
                "doctors_on_duty": doctors_total,
                "trauma_surgeons_available": trauma_surgeons_available,
                "anesthesiologists_available": anesthesiologists_available,
                "nurses_available": nurses_available,
            },
            "ambulances": {
                "total": amb_total,
                "available": amb_available,
                "dispatched": amb_dispatched,
            },
            "blood_inventory": {
                "total_units": total_blood_units,
                "o_negative_units": o_neg_units,
                "critical_reserve_healthy": o_neg_units >= (o_neg_record.minimum_threshold if o_neg_record else 10),
            },
            "safety_category": "GREEN",
            "timestamp": now.isoformat(),
        }
    finally:
        if should_close:
            db.close()


def calculate_resource_shortage(
    incoming_casualties: int,
    incident_id: Optional[str] = None,
    acute_ratio: float = 0.5,
    db: Optional[Session] = None,
) -> Dict[str, Any]:
    """Calculate resource deficits dynamically from live database capacity against incident demand.
    
    Safety Classification: GREEN (Deterministic computation / Read-only)
    """
    if incoming_casualties <= 0:
        raise InvalidQuantityError(
            f"Incoming casualty count must be greater than zero. Received: {incoming_casualties}"
        )

    capacity = get_hospital_capacity(db=db)

    # 1. Emergency Department Bed Shortage
    available_ed = capacity["emergency_beds"]["available"]
    ed_deficit = max(0, incoming_casualties - available_ed)

    # 2. Projected Critical / ICU Bed Shortage
    # Typically 20% of acute mass-casualty arrivals require immediate ICU stabilization
    projected_icu_demand = max(1, int(incoming_casualties * 0.20))
    available_icu = capacity["icu_beds"]["available"]
    icu_deficit = max(0, projected_icu_demand - available_icu)

    # 3. Projected Operating Room Shortage
    # Typically 12% of acute mass-casualty arrivals require immediate surgical intervention
    projected_or_demand = max(1, int(incoming_casualties * 0.12))
    available_ors = capacity["operating_rooms"]["open"]
    or_deficit = max(0, projected_or_demand - available_ors)

    # 4. Projected Trauma Surgical Staff Shortage
    projected_surgeons_demand = max(1, int(incoming_casualties * 0.10))
    available_surgeons = capacity["staff"]["trauma_surgeons_available"]
    surgeons_deficit = max(0, projected_surgeons_demand - available_surgeons)

    # 5. Projected Blood Bank Shortage (Standard 1.5 units per acute arrival)
    projected_blood_demand = int(incoming_casualties * 1.5)
    available_blood = capacity["blood_inventory"]["total_units"]
    blood_deficit = max(0, projected_blood_demand - available_blood)

    has_critical_shortage = (
        ed_deficit > 0 or icu_deficit > 0 or or_deficit > 0 or surgeons_deficit > 0 or blood_deficit > 0
    )

    recommended_actions = []
    if ed_deficit > 0:
        recommended_actions.append(
            f"Reserve all {available_ed} open emergency beds and prepare secondary triage staging (Deficit: {ed_deficit} beds)"
        )
    if or_deficit > 0:
        recommended_actions.append(
            f"Stage elective surgery postponement for in-use ORs to unlock surge capacity (Deficit: {or_deficit} ORs)"
        )
    if icu_deficit > 0:
        recommended_actions.append(
            f"Identify step-down ICU candidates and reserve available critical beds (Deficit: {icu_deficit} ICU beds)"
        )
    if has_critical_shortage:
        recommended_actions.append(
            "Propose emergency disaster declaration (Code Orange) to hospital command (RED)"
        )

    now = datetime.now(timezone.utc)

    return {
        "status": "SUCCESS",
        "incident_id": incident_id,
        "incoming_casualties": incoming_casualties,
        "current_capacity": {
            "emergency_beds_available": available_ed,
            "icu_beds_available": available_icu,
            "open_operating_rooms": available_ors,
            "trauma_surgeons_available": available_surgeons,
            "blood_units_available": available_blood,
        },
        "projected_demands": {
            "emergency_beds": incoming_casualties,
            "icu_beds": projected_icu_demand,
            "operating_rooms": projected_or_demand,
            "trauma_surgeons": projected_surgeons_demand,
            "blood_units": projected_blood_demand,
        },
        "deficits": {
            "emergency_beds": ed_deficit,
            "icu_beds": icu_deficit,
            "operating_rooms": or_deficit,
            "trauma_surgeons": surgeons_deficit,
            "blood_units": blood_deficit,
        },
        "has_critical_shortage": has_critical_shortage,
        "recommended_actions": recommended_actions,
        "safety_category": "GREEN",
        "timestamp": now.isoformat(),
    }
