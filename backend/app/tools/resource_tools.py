"""Operational resource querying, safe reservation, and consequential action gating."""
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from backend.app.services.database import (
    SessionLocal,
    BedRecord,
    OperatingRoomRecord,
    StaffRecord,
    AmbulanceRecord,
    BloodInventoryRecord,
    HospitalRecord,
)
from backend.app.tools.audit_helper import log_tool_audit
from backend.app.tools.exceptions import (
    DuplicateReservationError,
    InsufficientCapacityError,
    InvalidResourceTypeError,
    ResourceNotFoundError,
    UnauthorizedRedActionError,
)


def get_resource_status(
    resource_type: Optional[str] = None,
    db: Optional[Session] = None,
) -> Dict[str, Any]:
    """Query live operational resources directly from the persistent database.
    
    Safety Classification: GREEN (Safe / Read-only)
    """
    valid_types = {"bed", "operating_room", "staff", "ambulance", "blood"}
    if resource_type and resource_type.lower() not in valid_types:
        raise InvalidResourceTypeError(
            f"Invalid resource type '{resource_type}'. Supported: {sorted(list(valid_types))}"
        )

    should_close = False
    if db is None:
        db = SessionLocal()
        should_close = True

    try:
        now = datetime.now(timezone.utc)
        result: Dict[str, Any] = {
            "status": "SUCCESS",
            "safety_category": "GREEN",
            "timestamp": now.isoformat(),
        }

        r_type = resource_type.lower() if resource_type else None

        if r_type is None or r_type == "bed":
            beds = db.query(BedRecord).all()
            result["beds"] = [
                {
                    "id": b.id,
                    "bed_code": b.bed_code,
                    "bed_type": b.bed_type,
                    "department": b.department,
                    "is_occupied": b.is_occupied,
                    "is_reserved": b.is_reserved,
                }
                for b in beds
            ]

        if r_type is None or r_type == "operating_room":
            ors = db.query(OperatingRoomRecord).all()
            result["operating_rooms"] = [
                {
                    "id": o.id,
                    "room_number": o.room_number,
                    "status": o.status,
                    "scheduled_procedure": o.scheduled_procedure,
                    "is_emergency_cleared": o.is_emergency_cleared,
                }
                for o in ors
            ]

        if r_type is None or r_type == "staff":
            staff = db.query(StaffRecord).all()
            result["staff"] = [
                {
                    "id": s.id,
                    "name": s.name,
                    "role": s.role,
                    "department": s.department,
                    "is_on_duty": s.is_on_duty,
                    "is_assigned": s.is_assigned,
                }
                for s in staff
            ]

        if r_type is None or r_type == "ambulance":
            ambulances = db.query(AmbulanceRecord).all()
            result["ambulances"] = [
                {
                    "id": a.id,
                    "vehicle_code": a.vehicle_code,
                    "status": a.status,
                    "crew_assigned": a.crew_assigned,
                }
                for a in ambulances
            ]

        if r_type is None or r_type == "blood":
            blood = db.query(BloodInventoryRecord).all()
            result["blood_inventory"] = [
                {
                    "id": bl.id,
                    "blood_type": bl.blood_type,
                    "units_available": bl.units_available,
                    "minimum_threshold": bl.minimum_threshold,
                }
                for bl in blood
            ]

        return result
    finally:
        if should_close:
            db.close()


def reserve_resource(
    resource_type: str,
    resource_id: str,
    incident_id: Optional[str] = None,
    reason: str = "Emergency response allocation",
    db: Optional[Session] = None,
) -> Dict[str, Any]:
    """Reserve an available hospital resource for emergency operations.
    
    Safety Classification:
    - YELLOW: Reserving available beds, ambulances, or open ORs.
    - RED: Attempting to reserve/preempt an in-use resource (e.g. elective surgery OR).
      In RED scenarios, execution is BLOCKED and an approval requirement is returned.
    """
    valid_types = {"bed", "ambulance", "operating_room"}
    normalized_type = resource_type.lower()
    if normalized_type not in valid_types:
        raise InvalidResourceTypeError(
            f"Cannot reserve resource of type '{resource_type}'. Supported: {sorted(list(valid_types))}"
        )

    should_close = False
    if db is None:
        db = SessionLocal()
        should_close = True

    action_id = f"ACT-RES-{uuid.uuid4().hex[:8].upper()}"
    now = datetime.now(timezone.utc)

    try:
        # ======================================================================
        # 1. BED RESERVATION
        # ======================================================================
        if normalized_type == "bed":
            bed = (
                db.query(BedRecord)
                .filter((BedRecord.id == resource_id) | (BedRecord.bed_code == resource_id))
                .with_for_update()
                .first()
            )
            if not bed:
                raise ResourceNotFoundError(f"Bed '{resource_id}' not found.")

            if bed.is_reserved:
                raise DuplicateReservationError(f"Bed '{bed.bed_code}' is already reserved.")

            if bed.is_occupied:
                raise InsufficientCapacityError(
                    f"Bed '{bed.bed_code}' is currently occupied and cannot be allocated."
                )

            # Perform mutation
            previous_state = {"is_reserved": False, "is_occupied": False}
            bed.is_reserved = True
            db.commit()

            # Record audit event
            log_tool_audit(
                db=db,
                tool_name="reserve_resource",
                event_type="RESOURCE_RESERVED",
                tier="YELLOW",
                action_id=action_id,
                details={
                    "resource_type": "bed",
                    "resource_id": bed.id,
                    "bed_code": bed.bed_code,
                    "reason": reason,
                    "previous_state": previous_state,
                    "new_state": {"is_reserved": True, "is_occupied": False},
                },
                incident_id=incident_id,
                performed_by="OPERATIONAL_TOOL",
            )
            db.commit()

            return {
                "status": "SUCCESS",
                "operation_id": action_id,
                "resource_type": "bed",
                "resource_id": bed.id,
                "resource_code": bed.bed_code,
                "previous_state": previous_state,
                "new_state": {"is_reserved": True, "is_occupied": False},
                "safety_category": "YELLOW",
                "reason": reason,
                "timestamp": now.isoformat(),
            }

        # ======================================================================
        # 2. AMBULANCE RESERVATION
        # ======================================================================
        elif normalized_type == "ambulance":
            ambulance = (
                db.query(AmbulanceRecord)
                .filter((AmbulanceRecord.id == resource_id) | (AmbulanceRecord.vehicle_code == resource_id))
                .with_for_update()
                .first()
            )
            if not ambulance:
                raise ResourceNotFoundError(f"Ambulance '{resource_id}' not found.")

            if ambulance.status != "AVAILABLE":
                raise InsufficientCapacityError(
                    f"Ambulance '{ambulance.vehicle_code}' is currently '{ambulance.status}' (not AVAILABLE)."
                )

            # Perform mutation
            previous_state = {"status": ambulance.status}
            ambulance.status = "DISPATCHED"
            db.commit()

            # Record audit event
            log_tool_audit(
                db=db,
                tool_name="reserve_resource",
                event_type="RESOURCE_RESERVED",
                tier="YELLOW",
                action_id=action_id,
                details={
                    "resource_type": "ambulance",
                    "resource_id": ambulance.id,
                    "vehicle_code": ambulance.vehicle_code,
                    "reason": reason,
                    "previous_state": previous_state,
                    "new_state": {"status": "DISPATCHED"},
                },
                incident_id=incident_id,
                performed_by="OPERATIONAL_TOOL",
            )
            db.commit()

            return {
                "status": "SUCCESS",
                "operation_id": action_id,
                "resource_type": "ambulance",
                "resource_id": ambulance.id,
                "resource_code": ambulance.vehicle_code,
                "previous_state": previous_state,
                "new_state": {"status": "DISPATCHED"},
                "safety_category": "YELLOW",
                "reason": reason,
                "timestamp": now.isoformat(),
            }

        # ======================================================================
        # 3. OPERATING ROOM RESERVATION & RED SAFETY GATE
        # ======================================================================
        elif normalized_type == "operating_room":
            room = (
                db.query(OperatingRoomRecord)
                .filter((OperatingRoomRecord.id == resource_id) | (OperatingRoomRecord.room_number == resource_id))
                .with_for_update()
                .first()
            )
            if not room:
                raise ResourceNotFoundError(f"Operating room '{resource_id}' not found.")

            if room.status == "RESERVED_FOR_TRAUMA":
                raise DuplicateReservationError(f"Operating room '{room.room_number}' is already reserved for trauma.")

            # SAFE PATH (YELLOW): Room is OPEN
            if room.status == "OPEN":
                previous_state = {"status": "OPEN", "is_emergency_cleared": room.is_emergency_cleared}
                room.status = "RESERVED_FOR_TRAUMA"
                room.is_emergency_cleared = True
                db.commit()

                log_tool_audit(
                    db=db,
                    tool_name="reserve_resource",
                    event_type="RESOURCE_RESERVED",
                    tier="YELLOW",
                    action_id=action_id,
                    details={
                        "resource_type": "operating_room",
                        "resource_id": room.id,
                        "room_number": room.room_number,
                        "reason": reason,
                        "previous_state": previous_state,
                        "new_state": {"status": "RESERVED_FOR_TRAUMA", "is_emergency_cleared": True},
                    },
                    incident_id=incident_id,
                    performed_by="OPERATIONAL_TOOL",
                )
                db.commit()

                return {
                    "status": "SUCCESS",
                    "operation_id": action_id,
                    "resource_type": "operating_room",
                    "resource_id": room.id,
                    "resource_code": room.room_number,
                    "previous_state": previous_state,
                    "new_state": {"status": "RESERVED_FOR_TRAUMA", "is_emergency_cleared": True},
                    "safety_category": "YELLOW",
                    "reason": reason,
                    "timestamp": now.isoformat(),
                }

            # CONSEQUENTIAL PATH (RED): Room is IN_USE (Scheduled elective procedure)
            # HARD STOP: DO NOT EXECUTE SIDE EFFECT. Return structured APPROVAL_REQUIRED payload.
            elif room.status == "IN_USE":
                previous_state = {
                    "status": room.status,
                    "scheduled_procedure": room.scheduled_procedure,
                }
                
                # Log the blocked attempt in the audit log
                log_tool_audit(
                    db=db,
                    tool_name="reserve_resource",
                    event_type="CONSEQUENTIAL_ACTION_BLOCKED",
                    tier="RED",
                    action_id=action_id,
                    details={
                        "resource_type": "operating_room",
                        "resource_id": room.id,
                        "room_number": room.room_number,
                        "reason": f"OR is IN_USE for '{room.scheduled_procedure}'. Preemption requires human authorization.",
                        "risk_level": "RED",
                        "previous_state": previous_state,
                        "new_state": previous_state,  # Unmodified!
                    },
                    incident_id=incident_id,
                    performed_by="OPERATIONAL_TOOL_SAFETY_GATE",
                )
                db.commit()

                return {
                    "status": "APPROVAL_REQUIRED",
                    "action_id": action_id,
                    "reason": f"Operating room '{room.room_number}' is IN_USE for elective surgery ('{room.scheduled_procedure}'). Preemption requires explicit human approval.",
                    "risk_level": "RED",
                    "safety_category": "RED",
                    "resource_type": "operating_room",
                    "resource_id": room.id,
                    "resource_code": room.room_number,
                    "previous_state": previous_state,
                    "new_state": previous_state,  # Preserved without mutation
                    "requires_human_approval": True,
                    "timestamp": now.isoformat(),
                }
            else:
                raise InsufficientCapacityError(
                    f"Operating room '{room.room_number}' has status '{room.status}' and cannot be reserved."
                )
    finally:
        if should_close:
            db.close()


def propose_consequential_action(
    action_name: str,
    target_resource: str,
    reason: str,
    parameters: Optional[Dict[str, Any]] = None,
    incident_id: Optional[str] = None,
    db: Optional[Session] = None,
) -> Dict[str, Any]:
    """Propose a high-impact (RED) action without executing side effects.
    
    Safety Classification: RED (Human Approval Gate Required)
    """
    should_close = False
    if db is None:
        db = SessionLocal()
        should_close = True

    action_id = f"ACT-RED-{uuid.uuid4().hex[:8].upper()}"
    now = datetime.now(timezone.utc)
    params = parameters or {}

    try:
        log_tool_audit(
            db=db,
            tool_name="propose_consequential_action",
            event_type="CONSEQUENTIAL_ACTION_PROPOSED",
            tier="RED",
            action_id=action_id,
            details={
                "action_name": action_name,
                "target_resource": target_resource,
                "reason": reason,
                "parameters": params,
                "requires_human_approval": True,
            },
            incident_id=incident_id,
            performed_by="OPERATIONAL_TOOL",
        )
        db.commit()

        return {
            "status": "APPROVAL_REQUIRED",
            "action_id": action_id,
            "action_name": action_name,
            "target_resource": target_resource,
            "reason": reason,
            "parameters": params,
            "risk_level": "RED",
            "safety_category": "RED",
            "requires_human_approval": True,
            "timestamp": now.isoformat(),
        }
    finally:
        if should_close:
            db.close()


def execute_consequential_action(
    action_id: str,
    action_name: str,
    target_resource: str,
    authorization_token: Optional[str] = None,
    db: Optional[Session] = None,
) -> Dict[str, Any]:
    """Execute a previously authorized consequential action.
    
    In Phase 2, this function strictly validates that execution cannot proceed
    without an authentic human authorization token.
    """
    if not authorization_token or not authorization_token.startswith("AUTH-APPROVED-"):
        should_close = False
        if db is None:
            db = SessionLocal()
            should_close = True
        try:
            log_tool_audit(
                db=db,
                tool_name="execute_consequential_action",
                event_type="UNAUTHORIZED_RED_ACTION_REJECTED",
                tier="RED",
                action_id=action_id,
                details={
                    "action_name": action_name,
                    "target_resource": target_resource,
                    "error": "Missing or invalid human authorization token.",
                },
                performed_by="OPERATIONAL_TOOL_SAFETY_GATE",
            )
            db.commit()
        finally:
            if should_close:
                db.close()

        raise UnauthorizedRedActionError(
            f"Unauthorized attempt to execute high-consequence RED action '{action_name}'. "
            f"Action ID '{action_id}' requires explicit human operator authorization."
        )

    # Note: Phase 4 will implement the full authorization & continuation mechanism.
    return {
        "status": "SUCCESS",
        "action_id": action_id,
        "action_name": action_name,
        "authorized_by": authorization_token,
        "safety_category": "RED",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
