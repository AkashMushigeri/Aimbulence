"""Pydantic schemas and enums for emergency incidents."""
from datetime import datetime, timezone
from enum import Enum
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class IncidentSeverity(str, Enum):
    """Severity levels for incoming emergency incidents."""
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class IncidentStatus(str, Enum):
    """Operational statuses of an emergency incident."""
    REPORTED = "REPORTED"
    TRIAGING = "TRIAGING"
    MOBILIZING = "MOBILIZING"
    RESOLVED = "RESOLVED"
    CANCELLED = "CANCELLED"


class IncidentType(str, Enum):
    """Classifications of emergency incidents."""
    MASS_CASUALTY_COLLISION = "MASS_CASUALTY_COLLISION"
    TRANSIT_ACCIDENT = "TRANSIT_ACCIDENT"
    STRUCTURAL_COLLAPSE = "STRUCTURAL_COLLAPSE"
    HAZMAT = "HAZMAT"
    OTHER = "OTHER"


class IncidentCreate(BaseModel):
    """Payload for reporting a new incoming emergency incident."""
    title: str = Field(..., min_length=3, max_length=120, description="Summary title of the incident")
    incident_type: IncidentType = Field(default=IncidentType.MASS_CASUALTY_COLLISION, description="Category of the incident")
    severity: IncidentSeverity = Field(default=IncidentSeverity.CRITICAL, description="Assessed severity level")
    casualty_count: int = Field(..., ge=1, le=1000, description="Estimated total incoming casualties")
    location: str = Field(..., min_length=2, max_length=200, description="Location coordinates or roadway descriptor")
    eta_minutes: int = Field(..., ge=0, le=1440, description="Estimated minutes until first patient arrivals")
    description: Optional[str] = Field(default=None, max_length=1000, description="Additional situational dispatch notes")


class IncidentResponse(BaseModel):
    """Public representation of an emergency incident record."""
    id: str = Field(..., description="Unique incident identifier")
    title: str
    incident_type: IncidentType
    severity: IncidentSeverity
    casualty_count: int
    location: str
    eta_minutes: int
    description: Optional[str] = None
    status: IncidentStatus
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
