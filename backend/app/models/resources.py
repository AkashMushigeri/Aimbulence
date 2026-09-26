"""Pydantic schemas and enums for detailed operational resources."""
from datetime import datetime
from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class BedType(str, Enum):
    """Classification of hospital beds."""
    EMERGENCY = "EMERGENCY"
    ICU = "ICU"
    SURGICAL = "SURGICAL"
    GENERAL = "GENERAL"


class OperatingRoomStatus(str, Enum):
    """Operational status of surgical suites."""
    OPEN = "OPEN"
    IN_USE = "IN_USE"
    RESERVED_FOR_TRAUMA = "RESERVED_FOR_TRAUMA"
    MAINTENANCE = "MAINTENANCE"


class StaffRole(str, Enum):
    """Clinical and support staff operational roles."""
    DOCTOR = "DOCTOR"
    TRAUMA_SURGEON = "TRAUMA_SURGEON"
    NURSE = "NURSE"
    PARAMEDIC = "PARAMEDIC"
    ANESTHESIOLOGIST = "ANESTHESIOLOGIST"


class AmbulanceStatus(str, Enum):
    """Operational status of emergency response vehicles."""
    AVAILABLE = "AVAILABLE"
    DISPATCHED = "DISPATCHED"
    RETURNING = "RETURNING"
    MAINTENANCE = "MAINTENANCE"


class BloodType(str, Enum):
    """Standard blood type classifications."""
    O_NEG = "O_NEG"
    O_POS = "O_POS"
    A_NEG = "A_NEG"
    A_POS = "A_POS"
    B_NEG = "B_NEG"
    B_POS = "B_POS"
    AB_NEG = "AB_NEG"
    AB_POS = "AB_POS"


class BedResource(BaseModel):
    """Individual bed tracking."""
    id: str
    bed_code: str
    bed_type: BedType
    department: str
    is_occupied: bool
    is_reserved: bool

    model_config = ConfigDict(from_attributes=True)


class OperatingRoomResource(BaseModel):
    """Operating room status."""
    id: str
    room_number: str
    status: OperatingRoomStatus
    scheduled_procedure: Optional[str] = None
    is_emergency_cleared: bool = False

    model_config = ConfigDict(from_attributes=True)


class StaffResource(BaseModel):
    """Staff member on duty."""
    id: str
    name: str
    role: StaffRole
    department: str
    is_on_duty: bool
    is_assigned: bool

    model_config = ConfigDict(from_attributes=True)


class AmbulanceResource(BaseModel):
    """Emergency vehicle resource."""
    id: str
    vehicle_code: str
    status: AmbulanceStatus
    crew_assigned: bool = True

    model_config = ConfigDict(from_attributes=True)


class BloodInventoryResource(BaseModel):
    """Blood product inventory."""
    id: str
    blood_type: BloodType
    units_available: int = Field(ge=0)
    minimum_threshold: int = Field(ge=0)

    model_config = ConfigDict(from_attributes=True)


class ResourceStatus(BaseModel):
    """Comprehensive resource snapshot across all operational hospital assets."""
    summary: dict = Field(..., description="High-level counts of resources")
    beds: List[BedResource] = Field(default_factory=list)
    operating_rooms: List[OperatingRoomResource] = Field(default_factory=list)
    staff: List[StaffResource] = Field(default_factory=list)
    ambulances: List[AmbulanceResource] = Field(default_factory=list)
    blood_inventory: List[BloodInventoryResource] = Field(default_factory=list)
    last_updated: datetime

    model_config = ConfigDict(from_attributes=True)
