"""Audit helper utility for recording operational tool mutations and gates."""
import json
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from sqlalchemy.orm import Session

from backend.app.services.database import AuditEventRecord


def log_tool_audit(
    db: Session,
    tool_name: str,
    event_type: str,
    tier: str,
    action_id: str,
    details: Dict[str, Any],
    incident_id: Optional[str] = None,
    performed_by: str = "TOOL_LAYER",
) -> AuditEventRecord:
    """Creates and persists an immutable audit event record in the database."""
    now = datetime.now(timezone.utc)
    
    # Ensure details contains required audit fields
    payload = {
        "tool_name": tool_name,
        "action_id": action_id,
        "tier": tier,
        **details
    }
    
    audit_record = AuditEventRecord(
        id=str(uuid.uuid4()),
        incident_id=incident_id,
        event_type=event_type,
        action_name=tool_name,
        tier=tier,
        details_json=json.dumps(payload, default=str),
        performed_by=performed_by,
        timestamp=now,
    )
    db.add(audit_record)
    return audit_record
