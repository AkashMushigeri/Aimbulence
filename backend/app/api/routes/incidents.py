"""Emergency incident ingestion and query endpoints."""
import json
import uuid
from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from backend.app.models.incidents import IncidentCreate, IncidentResponse, IncidentStatus
from backend.app.services.database import get_db, IncidentRecord, AuditEventRecord

router = APIRouter(prefix="/incidents", tags=["Incidents"])


def _parse_incident_status(raw: str) -> IncidentStatus:
    try:
        return IncidentStatus(raw)
    except ValueError:
        if raw == "ACTIVE":
            return IncidentStatus.MOBILIZING
        return IncidentStatus.REPORTED


@router.post("", response_model=IncidentResponse, status_code=status.HTTP_201_CREATED, summary="Report an emergency mass-casualty incident")
def create_incident(payload: IncidentCreate, db: Session = Depends(get_db)):
    """Receives and validates incoming incident reports, persists to database, and writes an audit log."""
    now = datetime.now(timezone.utc)
    incident_id = f"INC-{uuid.uuid4().hex[:8].upper()}"

    record = IncidentRecord(
        id=incident_id,
        title=payload.title,
        incident_type=payload.incident_type.value,
        severity=payload.severity.value,
        casualty_count=payload.casualty_count,
        location=payload.location,
        eta_minutes=payload.eta_minutes,
        description=payload.description,
        status=IncidentStatus.REPORTED.value,
        created_at=now,
        updated_at=now,
    )
    db.add(record)

    # Immutable audit record of the incident receipt
    audit = AuditEventRecord(
        id=str(uuid.uuid4()),
        incident_id=incident_id,
        event_type="INCIDENT_REPORTED",
        action_name="INGEST_EMERGENCY_DISPATCH",
        tier="GREEN",
        details_json=json.dumps({
            "title": payload.title,
            "incident_type": payload.incident_type.value,
            "severity": payload.severity.value,
            "casualty_count": payload.casualty_count,
            "location": payload.location,
            "eta_minutes": payload.eta_minutes,
        }),
        performed_by="DISPATCH_RECEIVER",
        timestamp=now,
    )
    db.add(audit)

    db.commit()
    db.refresh(record)

    return IncidentResponse(
        id=record.id,
        title=record.title,
        incident_type=record.incident_type,
        severity=record.severity,
        casualty_count=record.casualty_count,
        location=record.location,
        eta_minutes=record.eta_minutes,
        description=record.description,
        status=_parse_incident_status(record.status),
        created_at=record.created_at,
        updated_at=record.updated_at,
    )


@router.get("", response_model=List[IncidentResponse], summary="List all emergency incidents")
def list_incidents(db: Session = Depends(get_db)):
    """Retrieves all tracked emergency incidents ordered by most recent first."""
    records = db.query(IncidentRecord).order_by(IncidentRecord.created_at.desc()).all()
    return [
        IncidentResponse(
            id=r.id,
            title=r.title,
            incident_type=r.incident_type,
            severity=r.severity,
            casualty_count=r.casualty_count,
            location=r.location,
            eta_minutes=r.eta_minutes,
            description=r.description,
            status=_parse_incident_status(r.status),
            created_at=r.created_at,
            updated_at=r.updated_at,
        )
        for r in records
    ]
