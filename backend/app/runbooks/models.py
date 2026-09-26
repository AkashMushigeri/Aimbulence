"""Data models and schemas for AIMBULENCE Runbook Execution Engine.

Defines Pydantic representations for runbook definitions, operational steps,
execution state machine, step results, and summary reports.
"""
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class RunbookState(str, Enum):
    """Lifecycle states of a runbook execution."""
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    WAITING_FOR_APPROVAL = "WAITING_FOR_APPROVAL"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    BLOCKED = "BLOCKED"


class StepStatus(str, Enum):
    """Execution status for an individual runbook step."""
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    SKIPPED = "SKIPPED"
    WAITING_FOR_APPROVAL = "WAITING_FOR_APPROVAL"
    FAILED = "FAILED"
    BLOCKED = "BLOCKED"


class SafetyCategory(str, Enum):
    """Safety classification for operational actions."""
    GREEN = "GREEN"    # Read-only or low-risk coordination
    YELLOW = "YELLOW"  # Reversible reservation of available resources
    RED = "RED"        # High-consequence action requiring TrueForge approval


class RunbookStepDefinition(BaseModel):
    """Declarative specification for a single runbook operational step."""
    step_id: str = Field(..., description="Unique step identifier, e.g. MCI-01-01")
    step_number: int = Field(..., description="Sequential position in runbook (1-based)")
    name: str = Field(..., description="Short operational title")
    description: str = Field(..., description="Detailed operational purpose")
    safety_category: SafetyCategory = Field(default=SafetyCategory.GREEN)
    action_tool: str = Field(..., description="Associated tool or handler function name")
    input_source: str = Field(..., description="Description of input parameters required")
    expected_output: str = Field(..., description="Description of expected outputs")
    verification_requirement: Optional[str] = Field(default=None, description="Post-execution check requirement")
    failure_behavior: str = Field(default="FAIL_RUNBOOK", description="FAIL_RUNBOOK, BLOCK_FOR_ESCALATION, or SKIP")

    model_config = ConfigDict(from_attributes=True)


class RunbookDefinition(BaseModel):
    """Complete declarative definition of an operational runbook."""
    runbook_id: str = Field(..., description="Runbook code, e.g. MCI-01")
    title: str = Field(..., description="Runbook title")
    description: str = Field(..., description="Operational objective")
    version: str = Field(default="1.0.0")
    steps: List[RunbookStepDefinition] = Field(..., description="Ordered operational steps")

    model_config = ConfigDict(from_attributes=True)


class RunbookStepResult(BaseModel):
    """Result payload of a single executed step."""
    step_id: str
    step_number: int
    name: str
    safety_category: SafetyCategory
    status: StepStatus
    input_summary: Dict[str, Any] = Field(default_factory=dict)
    output: Dict[str, Any] = Field(default_factory=dict)
    verification: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    started_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    completed_at: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class RunbookExecutionState(BaseModel):
    """Snapshot of runbook execution state."""
    execution_id: str
    runbook_id: str
    incident_id: str
    state: RunbookState
    current_step_id: Optional[str] = None
    checkpoint_id: Optional[str] = None
    parameters: Dict[str, Any] = Field(default_factory=dict)
    context: Dict[str, Any] = Field(default_factory=dict)
    completed_steps: List[str] = Field(default_factory=list)
    step_results: Dict[str, Any] = Field(default_factory=dict)
    summary: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    started_at: str
    updated_at: str
    completed_at: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class StartRunbookRequest(BaseModel):
    """API payload for initiating a runbook execution."""
    incident_id: str = Field(default="INC-MCI-42", description="Incident identifier")
    incoming_casualties: int = Field(default=42, ge=1, description="Reported incoming casualties")
    acute_ratio: float = Field(default=0.5, ge=0.0, le=1.0, description="Estimated acute triage ratio")


class StartRunbookResponse(BaseModel):
    """API response for started runbook."""
    runbook_execution_id: str
    runbook_id: str
    incident_id: str
    state: RunbookState
    current_step: Optional[str] = None
    checkpoint_id: Optional[str] = None
    message: str


class ResumeRunbookRequest(BaseModel):
    """Optional payload when resuming runbook."""
    reason: Optional[str] = Field(default="Human authorization checkpoint resolved", description="Operator notes")
