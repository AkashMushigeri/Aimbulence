"""Pydantic domain models for Emergency Pre-Arrival Coordination."""
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class EmergencyPriority(str, Enum):
    """Triage urgency priority for pre-arrival hospital preparation."""
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class PreArrivalStatus(str, Enum):
    """En-route ambulance progress and preparation status."""
    EN_ROUTE = "EN_ROUTE"
    PREPARING = "PREPARING"
    ARRIVED = "ARRIVED"
    CANCELLED = "CANCELLED"


class ResourceCategory(str, Enum):
    """Classification of hospital preparation resources."""
    BED_FACILITY = "BED / FACILITY"
    SPECIALIST = "SPECIALIST"
    BLOOD_BANK = "BLOOD BANK"
    MEDICATION_SUPPLIES = "MEDICATION / SUPPLIES"
    IMAGING_RADIOLOGY = "IMAGING / RADIOLOGY"
    OPERATION_THEATRE = "OPERATION THEATRE"
    LABORATORY = "LABORATORY"


class HospitalAvailability(str, Enum):
    """Resource availability states in the hospital."""
    AVAILABLE = "AVAILABLE"
    LIMITED = "LIMITED"
    UNAVAILABLE = "UNAVAILABLE"
    PREPARING = "PREPARING"
    RESERVED = "RESERVED"


class ActionDecision(str, Enum):
    """Human-in-the-loop authorization decision."""
    PENDING = "PENDING"
    APPROVE = "APPROVE"
    APPROVED = "APPROVED"
    REJECT = "REJECT"
    REJECTED = "REJECTED"
    ACKNOWLEDGE = "ACKNOWLEDGE"
    ACKNOWLEDGED = "ACKNOWLEDGED"


class VitalsSchema(BaseModel):
    """Patient vital signs recorded in the ambulance."""
    bp: Optional[str] = Field(default=None, description="Blood pressure, e.g. '90/60'")
    hr: Optional[int] = Field(default=None, ge=20, le=300, description="Heart rate in BPM")
    spo2: Optional[int] = Field(default=None, ge=40, le=100, description="Pulse oximetry percentage")
    temp: Optional[str] = Field(default=None, description="Body temperature, e.g. '98.6 F'")
    rr: Optional[int] = Field(default=None, ge=4, le=60, description="Respiratory rate per minute")


class PreArrivalCaseCreate(BaseModel):
    """Payload to create or report an incoming ambulance emergency case."""
    ambulance_id: str = Field(default="AMB-102", description="Unique vehicle code")
    raw_description: Optional[str] = Field(default=None, description="Natural language paramedic clinical report")
    patient_name: Optional[str] = Field(default="Unidentified Patient", description="Patient name if known")
    patient_age: Optional[int] = Field(default=None, ge=0, le=130, description="Patient age in years")
    patient_gender: Optional[str] = Field(default=None, description="Male / Female / Other")
    symptoms: List[str] = Field(default_factory=list, description="Observed acute symptoms")
    vitals: Optional[VitalsSchema] = Field(default_factory=VitalsSchema)
    allergies: Optional[str] = Field(default="None known", description="Known drug/food allergies")
    medical_conditions: Optional[str] = Field(default="None known", description="Existing medical history")
    current_medications: Optional[str] = Field(default="Unknown", description="Active home medications")
    incident_type: Optional[str] = Field(default="Emergency Transport", description="Incident classification")
    consciousness: Optional[str] = Field(default="Alert", description="Neurological / GCS observation")
    blood_group: Optional[str] = Field(default="Unknown", description="ABO/Rh blood group")
    oxygen_required: bool = Field(default=False, description="Supplemental oxygen in use")
    pain_level: Optional[str] = Field(default=None, description="Verbal pain score, e.g. '8/10'")
    current_location_name: str = Field(default="Tumakuru Road", description="Street name or landmark descriptor")
    destination_hospital: str = Field(default="Metro Central Trauma Hospital", description="Target facility")
    distance_km: float = Field(default=8.4, ge=0.0, description="Distance remaining in kilometers")
    eta_minutes: int = Field(default=14, ge=0, description="Estimated arrival time in minutes")
    latitude: Optional[float] = Field(default=13.0489)
    longitude: Optional[float] = Field(default=77.5147)


class PreArrivalActionResponse(BaseModel):
    """Specific preparation recommendation within an emergency preparation plan."""
    id: str
    case_id: str
    resource_category: str
    resource_name: str
    recommended_status: str
    reason: str
    hospital_availability: str
    decision_type: str
    decision_by: Optional[str] = None
    decision_reason: Optional[str] = None
    decision_timestamp: Optional[datetime] = None
    requires_approval: bool = False
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PreArrivalCaseResponse(BaseModel):
    """Complete pre-arrival emergency case, clinical extraction, and preparation plan."""
    id: str
    ambulance_id: str
    patient_name: Optional[str] = None
    patient_age: Optional[int] = None
    patient_gender: Optional[str] = None
    symptoms: List[str] = Field(default_factory=list)
    vitals: VitalsSchema
    allergies: Optional[str] = None
    medical_conditions: Optional[str] = None
    current_medications: Optional[str] = None
    incident_type: Optional[str] = None
    consciousness: Optional[str] = None
    blood_group: Optional[str] = None
    oxygen_required: bool = False
    pain_level: Optional[str] = None
    raw_description: Optional[str] = None
    emergency_category: str
    priority: str
    clinical_summary: str
    current_location_name: str
    destination_hospital: str
    distance_km: float
    eta_minutes: int
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    status: str
    immediate_actions: List[str] = Field(default_factory=list)
    actions: List[PreArrivalActionResponse] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime
    arrived_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class ActionDecisionRequest(BaseModel):
    """Authorized clinician human-in-the-loop decision payload."""
    decision: ActionDecision = Field(..., description="APPROVE, REJECT, or ACKNOWLEDGE")
    authorized_by: str = Field(..., min_length=2, max_length=100, description="Name/title of authorized personnel")
    reason: Optional[str] = Field(default=None, max_length=255, description="Clinical or operational justification")


class LocationUpdateRequest(BaseModel):
    """Telemetry telemetry update for an active ambulance."""
    current_location_name: Optional[str] = None
    distance_km: Optional[float] = None
    eta_minutes: Optional[int] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
