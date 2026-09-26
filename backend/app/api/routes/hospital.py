"""Hospital operational state, resource inventory, and audit log endpoints."""
import json
from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.app.models.hospital import DepartmentStatus, HospitalStatus, EmergencyCodeStatus
from backend.app.models.resources import (
    ResourceStatus,
    BedResource,
    OperatingRoomResource,
    StaffResource,
    AmbulanceResource,
    BloodInventoryResource,
)
from backend.app.models.actions import AuditEvent
from backend.app.services.database import (
    get_db,
    HospitalRecord,
    DepartmentRecord,
    BedRecord,
    OperatingRoomRecord,
    StaffRecord,
    AmbulanceRecord,
    BloodInventoryRecord,
    IncidentRecord,
    AuditEventRecord,
)

router = APIRouter(tags=["Hospital Operations"])


@router.get("/hospital/status", response_model=HospitalStatus, summary="Get aggregate hospital operational capacity")
def get_hospital_status(db: Session = Depends(get_db)):
    """Calculates and returns current hospital capacity, code status, and department metrics from the database."""
    hospital = db.query(HospitalRecord).first()
    if not hospital:
        raise HTTPException(status_code=404, detail="Hospital operational baseline not initialized.")

    # Bed counts
    ed_beds_total = db.query(BedRecord).filter(BedRecord.bed_type == "EMERGENCY").count()
    ed_beds_available = db.query(BedRecord).filter(
        BedRecord.bed_type == "EMERGENCY",
        BedRecord.is_occupied == False,
        BedRecord.is_reserved == False
    ).count()

    icu_beds_total = db.query(BedRecord).filter(BedRecord.bed_type == "ICU").count()
    icu_beds_available = db.query(BedRecord).filter(
        BedRecord.bed_type == "ICU",
        BedRecord.is_occupied == False,
        BedRecord.is_reserved == False
    ).count()

    # Operating rooms
    or_total = db.query(OperatingRoomRecord).count()
    or_available = db.query(OperatingRoomRecord).filter(OperatingRoomRecord.status == "OPEN").count()

    # Staff counts
    doctors_available = db.query(StaffRecord).filter(
        StaffRecord.role.in_(["DOCTOR", "TRAUMA_SURGEON", "ANESTHESIOLOGIST"]),
        StaffRecord.is_on_duty == True,
        StaffRecord.is_assigned == False
    ).count()

    nurses_available = db.query(StaffRecord).filter(
        StaffRecord.role == "NURSE",
        StaffRecord.is_on_duty == True,
        StaffRecord.is_assigned == False
    ).count()

    # Ambulances
    ambulances_available = db.query(AmbulanceRecord).filter(AmbulanceRecord.status == "AVAILABLE").count()

    # Blood units
    blood_units_records = db.query(BloodInventoryRecord).all()
    blood_units_total = sum(b.units_available for b in blood_units_records)

    # Active incidents
    active_incidents = db.query(IncidentRecord).filter(
        IncidentRecord.status.notin_(["RESOLVED", "CANCELLED"])
    ).count()

    # Departments list
    departments_records = db.query(DepartmentRecord).filter(DepartmentRecord.hospital_id == hospital.id).all()
    departments_status = [
        DepartmentStatus(
            name=d.name,
            department_type=d.department_type,
            total_beds=d.total_beds,
            available_beds=d.available_beds,
            occupied_beds=d.occupied_beds,
            staff_on_duty=d.staff_on_duty,
            status_note=d.status_note,
        )
        for d in departments_records
    ]

    return HospitalStatus(
        hospital_name=hospital.name,
        operational_code=EmergencyCodeStatus(hospital.operational_code),
        emergency_beds_available=ed_beds_available,
        emergency_beds_total=ed_beds_total,
        icu_beds_available=icu_beds_available,
        icu_beds_total=icu_beds_total,
        operating_rooms_available=or_available,
        operating_rooms_total=or_total,
        doctors_available=doctors_available,
        nurses_available=nurses_available,
        ambulances_available=ambulances_available,
        blood_units_available=blood_units_total,
        active_incidents_count=active_incidents,
        last_updated=hospital.last_updated,
        departments=departments_status,
    )


@router.get("/resources", response_model=ResourceStatus, summary="Get full inventory of operational assets")
def get_resources(db: Session = Depends(get_db)):
    """Returns granular tracking records for all beds, operating rooms, staff, ambulances, and blood inventory."""
    beds = db.query(BedRecord).all()
    operating_rooms = db.query(OperatingRoomRecord).all()
    staff = db.query(StaffRecord).all()
    ambulances = db.query(AmbulanceRecord).all()
    blood = db.query(BloodInventoryRecord).all()

    summary = {
        "total_beds": len(beds),
        "available_beds": sum(1 for b in beds if not b.is_occupied and not b.is_reserved),
        "total_operating_rooms": len(operating_rooms),
        "open_operating_rooms": sum(1 for o in operating_rooms if o.status == "OPEN"),
        "total_staff_on_duty": sum(1 for s in staff if s.is_on_duty),
        "total_ambulances_available": sum(1 for a in ambulances if a.status == "AVAILABLE"),
        "total_blood_units": sum(b.units_available for b in blood),
    }

    return ResourceStatus(
        summary=summary,
        beds=[
            BedResource(
                id=b.id,
                bed_code=b.bed_code,
                bed_type=b.bed_type,
                department=b.department,
                is_occupied=b.is_occupied,
                is_reserved=b.is_reserved,
            )
            for b in beds
        ],
        operating_rooms=[
            OperatingRoomResource(
                id=o.id,
                room_number=o.room_number,
                status=o.status,
                scheduled_procedure=o.scheduled_procedure,
                is_emergency_cleared=o.is_emergency_cleared,
            )
            for o in operating_rooms
        ],
        staff=[
            StaffResource(
                id=s.id,
                name=s.name,
                role=s.role,
                department=s.department,
                is_on_duty=s.is_on_duty,
                is_assigned=s.is_assigned,
            )
            for s in staff
        ],
        ambulances=[
            AmbulanceResource(
                id=a.id,
                vehicle_code=a.vehicle_code,
                status=a.status,
                crew_assigned=a.crew_assigned,
            )
            for a in ambulances
        ],
        blood_inventory=[
            BloodInventoryResource(
                id=bl.id,
                blood_type=bl.blood_type,
                units_available=bl.units_available,
                minimum_threshold=bl.minimum_threshold,
            )
            for bl in blood
        ],
        last_updated=datetime.now(timezone.utc),
    )


@router.get("/audit-log", response_model=List[AuditEvent], summary="Get chronological operational audit records")
def get_audit_log(limit: int = 50, db: Session = Depends(get_db)):
    """Returns chronological audit records of system state modifications, runbook actions, and approvals."""
    records = (
        db.query(AuditEventRecord)
        .order_by(AuditEventRecord.timestamp.desc())
        .limit(limit)
        .all()
    )

    results = []
    for r in records:
        try:
            details = json.loads(r.details_json) if r.details_json else {}
        except Exception:
            details = {"raw": r.details_json}

        results.append(
            AuditEvent(
                id=r.id,
                incident_id=r.incident_id,
                event_type=r.event_type,
                action_name=r.action_name,
                tier=r.tier,
                details=details,
                performed_by=r.performed_by,
                timestamp=r.timestamp,
            )
        )

    return results
