"""Operational coordination task creation and tracking tools."""
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from backend.app.services.database import SessionLocal, OperationalTaskRecord
from backend.app.tools.audit_helper import log_tool_audit
from backend.app.tools.exceptions import ToolError


def create_operational_task(
    title: str,
    incident_id: Optional[str] = None,
    tier: str = "GREEN",
    details: Optional[Dict[str, Any]] = None,
    db: Optional[Session] = None,
) -> Dict[str, Any]:
    """Create a real persisted operational coordination task in the database.
    
    Safety Classification: GREEN (Safe internal coordination)
    """
    if not title or len(title.strip()) < 3:
        raise ToolError("Task title must be at least 3 characters long.")

    should_close = False
    if db is None:
        db = SessionLocal()
        should_close = True

    task_id = f"TASK-{uuid.uuid4().hex[:8].upper()}"
    now = datetime.now(timezone.utc)
    clean_title = title.strip()
    clean_tier = tier.upper() if tier else "GREEN"

    try:
        task_record = OperationalTaskRecord(
            id=task_id,
            incident_id=incident_id,
            title=clean_title,
            tier=clean_tier,
            status="PENDING",
            created_at=now,
        )
        db.add(task_record)
        db.commit()

        # Record audit event
        log_tool_audit(
            db=db,
            tool_name="create_operational_task",
            event_type="TASK_CREATED",
            tier=clean_tier,
            action_id=task_id,
            details={
                "task_id": task_id,
                "title": clean_title,
                "status": "PENDING",
                "custom_details": details or {},
            },
            incident_id=incident_id,
            performed_by="OPERATIONAL_TOOL",
        )
        db.commit()

        return {
            "status": "SUCCESS",
            "task_id": task_id,
            "title": clean_title,
            "tier": clean_tier,
            "operational_status": "PENDING",
            "incident_id": incident_id,
            "safety_category": "GREEN",
            "persisted": True,
            "timestamp": now.isoformat(),
        }
    finally:
        if should_close:
            db.close()


def get_operational_tasks(
    incident_id: Optional[str] = None,
    status: Optional[str] = None,
    db: Optional[Session] = None,
) -> List[Dict[str, Any]]:
    """Query operational tasks from the database."""
    should_close = False
    if db is None:
        db = SessionLocal()
        should_close = True

    try:
        query = db.query(OperationalTaskRecord)
        if incident_id:
            query = query.filter(OperationalTaskRecord.incident_id == incident_id)
        if status:
            query = query.filter(OperationalTaskRecord.status == status.upper())

        records = query.order_by(OperationalTaskRecord.created_at.desc()).all()
        return [
            {
                "task_id": r.id,
                "title": r.title,
                "tier": r.tier,
                "status": r.status,
                "incident_id": r.incident_id,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in records
        ]
    finally:
        if should_close:
            db.close()
