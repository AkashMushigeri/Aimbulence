"""Operational state verification tool comparing post-action expectations against persisted reality."""
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from sqlalchemy.orm import Session

from backend.app.services.database import (
    SessionLocal,
    BedRecord,
    OperatingRoomRecord,
    AmbulanceRecord,
    HospitalRecord,
    OperationalTaskRecord,
    IncidentRecord,
)
from backend.app.tools.audit_helper import log_tool_audit
from backend.app.tools.exceptions import InvalidResourceTypeError


def verify_operational_status(
    target_entity: str,
    entity_id: str,
    expected_field: str,
    expected_value: Any,
    db: Optional[Session] = None,
) -> Dict[str, Any]:
    """Read the database after an action and independently verify whether the expected state materialized.
    
    Safety Classification: GREEN (Safe inspection / Read-only)
    """
    valid_entities = {
        "bed": BedRecord,
        "operating_room": OperatingRoomRecord,
        "ambulance": AmbulanceRecord,
        "hospital": HospitalRecord,
        "task": OperationalTaskRecord,
        "incident": IncidentRecord,
    }

    normalized_entity = target_entity.lower().strip()
    if normalized_entity not in valid_entities:
        raise InvalidResourceTypeError(
            f"Unsupported verification target entity '{target_entity}'. Supported: {sorted(list(valid_entities.keys()))}"
        )

    model_class = valid_entities[normalized_entity]

    should_close = False
    if db is None:
        db = SessionLocal()
        should_close = True

    action_id = f"VERIF-{uuid.uuid4().hex[:8].upper()}"
    now = datetime.now(timezone.utc)

    try:
        # Query record by primary ID or unique code
        if normalized_entity == "bed":
            record = (
                db.query(BedRecord)
                .filter((BedRecord.id == entity_id) | (BedRecord.bed_code == entity_id))
                .first()
            )
        elif normalized_entity == "operating_room":
            record = (
                db.query(OperatingRoomRecord)
                .filter((OperatingRoomRecord.id == entity_id) | (OperatingRoomRecord.room_number == entity_id))
                .first()
            )
        elif normalized_entity == "ambulance":
            record = (
                db.query(AmbulanceRecord)
                .filter((AmbulanceRecord.id == entity_id) | (AmbulanceRecord.vehicle_code == entity_id))
                .first()
            )
        else:
            record = db.query(model_class).filter(model_class.id == entity_id).first()

        if not record:
            log_tool_audit(
                db=db,
                tool_name="verify_operational_status",
                event_type="VERIFICATION_FAILED_NOT_FOUND",
                tier="GREEN",
                action_id=action_id,
                details={
                    "target_entity": target_entity,
                    "entity_id": entity_id,
                    "error": "Entity not found in database.",
                },
                performed_by="STATE_VERIFIER",
            )
            db.commit()

            return {
                "verified": False,
                "status": "VERIFICATION_FAILED",
                "target_entity": target_entity,
                "entity_id": entity_id,
                "reason": f"Target entity '{target_entity}' with identifier '{entity_id}' not found in database.",
                "expected_field": expected_field,
                "expected_value": expected_value,
                "actual_value": None,
                "safety_category": "GREEN",
                "timestamp": now.isoformat(),
            }

        # Inspect attribute on database record
        if not hasattr(record, expected_field):
            return {
                "verified": False,
                "status": "VERIFICATION_FAILED",
                "target_entity": target_entity,
                "entity_id": entity_id,
                "reason": f"Attribute '{expected_field}' does not exist on entity '{target_entity}'.",
                "expected_field": expected_field,
                "expected_value": expected_value,
                "actual_value": None,
                "safety_category": "GREEN",
                "timestamp": now.isoformat(),
            }

        actual_value = getattr(record, expected_field)
        matched = (actual_value == expected_value)

        # Log audit trail for verification result
        log_tool_audit(
            db=db,
            tool_name="verify_operational_status",
            event_type="STATE_VERIFIED" if matched else "VERIFICATION_DISCREPANCY",
            tier="GREEN",
            action_id=action_id,
            details={
                "target_entity": target_entity,
                "entity_id": entity_id,
                "expected_field": expected_field,
                "expected_value": expected_value,
                "actual_value": actual_value,
                "matched": matched,
            },
            performed_by="STATE_VERIFIER",
        )
        db.commit()

        return {
            "verified": matched,
            "status": "VERIFIED" if matched else "VERIFICATION_FAILED",
            "target_entity": target_entity,
            "entity_id": entity_id,
            "expected_field": expected_field,
            "expected_value": expected_value,
            "actual_value": actual_value,
            "matched": matched,
            "safety_category": "GREEN",
            "timestamp": now.isoformat(),
        }
    finally:
        if should_close:
            db.close()
