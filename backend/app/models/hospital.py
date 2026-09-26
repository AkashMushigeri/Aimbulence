"""Pydantic schemas and enums for overall hospital operational status."""
from datetime import datetime
from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class EmergencyCodeStatus(str, Enum):
    """Hospital emergency activation status."""
    NORMAL = "NORMAL"
    CODE_YELLOW = "CODE_YELLOW"      # Internal disaster / preparation
    CODE_ORANGE = "CODE_ORANGE"      # External disaster / mass casualty declared
    CODE_RED = "CODE_RED"            # Fire / direct facility threat


class DepartmentType(str, Enum):
    """Hospital clinical and operational units."""
    EMERGENCY = "EMERGENCY"
    ICU = "ICU"
    SURGERY = "SURGERY"
    TRAUMA = "TRAUMA"
    GENERAL_WARD = "GENERAL_WARD"
    BLOOD_BANK = "BLOOD_BANK"


class DepartmentStatus(BaseModel):
    """Operational status of a specific hospital department."""
    name: str
    department_type: DepartmentType
    total_beds: int = Field(ge=0)
    available_beds: int = Field(ge=0)
    occupied_beds: int = Field(ge=0)
    staff_on_duty: int = Field(ge=0)
    status_note: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class HospitalStatus(BaseModel):
    """Aggregated snapshot of hospital operational status and capacity."""
    hospital_name: str
    operational_code: EmergencyCodeStatus
    emergency_beds_available: int = Field(ge=0)
    emergency_beds_total: int = Field(ge=0)
    icu_beds_available: int = Field(ge=0)
    icu_beds_total: int = Field(ge=0)
    operating_rooms_available: int = Field(ge=0)
    operating_rooms_total: int = Field(ge=0)
    doctors_available: int = Field(ge=0)
    nurses_available: int = Field(ge=0)
    ambulances_available: int = Field(ge=0)
    blood_units_available: int = Field(ge=0)
    active_incidents_count: int = Field(ge=0)
    last_updated: datetime
    departments: List[DepartmentStatus] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)
