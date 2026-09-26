"""TrueForge Human-in-the-Loop Approval Checkpoint Manager.

Implements the TrueForge interrupt/checkpoint mechanism for high-consequence (RED)
hospital operational actions, enforcing strict single-use authorization tokens,
rejection handling, state mutation, and post-execution verification.
"""
import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from backend.app.services.database import (
    SessionLocal,
    OperatingRoomRecord,
    AuditEventRecord,
)
from backend.app.tools.audit_helper import log_tool_audit
from backend.app.tools.exceptions import (
    ResourceNotFoundError,
    StaleStateError,
    UnauthorizedRedActionError,
)
from backend.app.tools.verification_tools import verify_operational_status


# ==============================================================================
# 1. MODELS AND SCHEMAS
# ==============================================================================

class CheckpointState(str, Enum):
    """Lifecycle states of a TrueForge approval checkpoint."""
    PAUSED_FOR_APPROVAL = "tool.approval_required"  # TrueForge official event type
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    EXECUTED = "EXECUTED"
    FAILED = "FAILED"


class ApprovalDecisionType(str, Enum):
    """Supported human operator decisions."""
    ALLOW = "allow"      # TrueForge AgentApprovalDecisionAllowSchema
    DENY = "deny"        # TrueForge AgentApprovalDecisionDenySchema
    APPROVE = "APPROVE"  # Canonical alias
    REJECT = "REJECT"    # Canonical alias


class RedActionProposal(BaseModel):
    """Structured proposal for a high-consequence (RED) hospital operational action."""
    action_id: str = Field(..., description="Unique action identifier")
    action_type: str = Field(..., description="Classification of action, e.g. PREEMPT_OPERATING_ROOM")
    risk_level: str = Field(default="RED", description="Risk classification")
    safety_category: str = Field(default="RED", description="Safety category")
    affected_resource: str = Field(..., description="Specific resource, e.g. OR-3")
    current_state: Dict[str, Any] = Field(..., description="Current operational state of resource")
    proposed_state: Dict[str, Any] = Field(..., description="Target state upon execution")
    reason: str = Field(..., description="Operational justification and incident context")
    expected_benefit: str = Field(..., description="Anticipated operational surge benefit")
    potential_consequence: str = Field(..., description="Clinical or operational trade-off")
    requires_human_approval: bool = Field(default=True, description="Enforces approval checkpoint")
    incident_id: Optional[str] = Field(default=None, description="Associated emergency incident")
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    model_config = ConfigDict(from_attributes=True)


class ApprovalDecisionPayload(BaseModel):
    """Operator submission payload resolving a checkpoint."""
    decision: ApprovalDecisionType = Field(..., description="allow/APPROVE or deny/REJECT")
    decision_by: str = Field(..., min_length=2, description="Name and role of approving authority")
    reason: Optional[str] = Field(default=None, description="Clinical or command reasoning")


class TrueForgeApprovalCheckpoint(BaseModel):
    """State record for a TrueForge human-in-the-loop checkpoint."""
    checkpoint_id: str
    thread_id: str
    tool_call_id: str
    proposal: RedActionProposal
    state: CheckpointState
    authorization_token: Optional[str] = None
    token_consumed: bool = False
    decision_by: Optional[str] = None
    decision_reason: Optional[str] = None
    created_at: str
    resolved_at: Optional[str] = None
    executed_at: Optional[str] = None
    execution_result: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(from_attributes=True)


# ==============================================================================
# 2. TRUEFORGE APPROVAL MANAGER
# ==============================================================================

class TrueForgeApprovalManager:
    """Manages TrueForge approval checkpoints, cryptographic token issuance, and gated execution."""

    def __init__(self):
        self._checkpoints: Dict[str, TrueForgeApprovalCheckpoint] = {}

    def clear(self):
        """Reset internal checkpoint registry (useful for isolated testing)."""
        self._checkpoints.clear()

    def list_checkpoints(self) -> List[TrueForgeApprovalCheckpoint]:
        """Return all active and historical approval checkpoints."""
        return list(self._checkpoints.values())

    def get_checkpoint(self, checkpoint_id: str) -> TrueForgeApprovalCheckpoint:
        """Retrieve a specific checkpoint by ID."""
        if checkpoint_id not in self._checkpoints:
            raise ResourceNotFoundError(f"Approval checkpoint '{checkpoint_id}' not found.")
        return self._checkpoints[checkpoint_id]

    def pause_for_approval(
        self,
        proposal: RedActionProposal,
        thread_id: str = "thread-mci-42",
        tool_call_id: Optional[str] = None,
        db: Optional[Session] = None,
    ) -> TrueForgeApprovalCheckpoint:
        """Halt execution at a TrueForge approval checkpoint awaiting human intervention."""
        checkpoint_id = f"CHK-{uuid.uuid4().hex[:8].upper()}"
        t_call_id = tool_call_id or f"call_{uuid.uuid4().hex[:12]}"
        now = datetime.now(timezone.utc).isoformat()

        checkpoint = TrueForgeApprovalCheckpoint(
            checkpoint_id=checkpoint_id,
            thread_id=thread_id,
            tool_call_id=t_call_id,
            proposal=proposal,
            state=CheckpointState.PAUSED_FOR_APPROVAL,
            created_at=now,
        )
        self._checkpoints[checkpoint_id] = checkpoint

        # Log audit event
        should_close = False
        if db is None:
            db = SessionLocal()
            should_close = True
        try:
            log_tool_audit(
                db=db,
                tool_name="trueforge_checkpoint_pause",
                event_type="CHECKPOINT_CREATED",
                tier="RED",
                action_id=proposal.action_id,
                details={
                    "checkpoint_id": checkpoint_id,
                    "event": "tool.approval_required",
                    "resource": proposal.affected_resource,
                    "action_type": proposal.action_type,
                    "reason": proposal.reason,
                    "state": CheckpointState.PAUSED_FOR_APPROVAL.value,
                },
                incident_id=proposal.incident_id,
                performed_by="TRUEFORGE_HARNESS",
            )
            db.commit()
        finally:
            if should_close:
                db.close()

        return checkpoint

    def submit_decision(
        self,
        checkpoint_id: str,
        decision: ApprovalDecisionType,
        decision_by: str,
        reason: Optional[str] = None,
        db: Optional[Session] = None,
    ) -> TrueForgeApprovalCheckpoint:
        """Record human operator authorization decision (APPROVE or REJECT)."""
        checkpoint = self.get_checkpoint(checkpoint_id)

        if checkpoint.state != CheckpointState.PAUSED_FOR_APPROVAL:
            raise StaleStateError(
                f"Checkpoint '{checkpoint_id}' is in state '{checkpoint.state.value}' and cannot be modified."
            )

        now = datetime.now(timezone.utc).isoformat()
        checkpoint.resolved_at = now
        checkpoint.decision_by = decision_by
        checkpoint.decision_reason = reason

        normalized_decision = decision.value if isinstance(decision, ApprovalDecisionType) else str(decision)
        is_allowed = normalized_decision.lower() in ("allow", "approve")

        should_close = False
        if db is None:
            db = SessionLocal()
            should_close = True

        try:
            if is_allowed:
                # Generate unique authorization token bound to proposal and resource
                bound_token = f"AUTH-APPROVED-{checkpoint.checkpoint_id}-{checkpoint.proposal.affected_resource}-{uuid.uuid4().hex[:8].upper()}"
                checkpoint.state = CheckpointState.APPROVED
                checkpoint.authorization_token = bound_token
                checkpoint.token_consumed = False

                log_tool_audit(
                    db=db,
                    tool_name="trueforge_checkpoint_decision",
                    event_type="APPROVAL_GRANTED",
                    tier="RED",
                    action_id=checkpoint.proposal.action_id,
                    details={
                        "checkpoint_id": checkpoint.checkpoint_id,
                        "decision": "APPROVED",
                        "decision_by": decision_by,
                        "token_issued": bound_token,
                        "resource": checkpoint.proposal.affected_resource,
                    },
                    incident_id=checkpoint.proposal.incident_id,
                    performed_by=decision_by,
                )
            else:
                checkpoint.state = CheckpointState.REJECTED
                checkpoint.authorization_token = None
                checkpoint.token_consumed = False

                log_tool_audit(
                    db=db,
                    tool_name="trueforge_checkpoint_decision",
                    event_type="APPROVAL_REJECTED",
                    tier="RED",
                    action_id=checkpoint.proposal.action_id,
                    details={
                        "checkpoint_id": checkpoint.checkpoint_id,
                        "decision": "REJECTED",
                        "decision_by": decision_by,
                        "reason": reason or "No clinical rationale provided.",
                        "resource": checkpoint.proposal.affected_resource,
                    },
                    incident_id=checkpoint.proposal.incident_id,
                    performed_by=decision_by,
                )
            db.commit()
        finally:
            if should_close:
                db.close()

        return checkpoint

    def validate_authorization(
        self,
        checkpoint_id: str,
        action_id: str,
        resource_id: str,
        authorization_token: Optional[str],
    ) -> TrueForgeApprovalCheckpoint:
        """Strictly validate authorization token bindings and consume token on single use."""
        if not authorization_token or not authorization_token.startswith("AUTH-APPROVED-"):
            raise UnauthorizedRedActionError(
                "Execution rejected: Missing or invalid authorization token format."
            )

        checkpoint = self.get_checkpoint(checkpoint_id)

        if checkpoint.token_consumed:
            raise UnauthorizedRedActionError(
                "Execution rejected: Authorization token has already been consumed. Replay attack prevented."
            )

        if checkpoint.state == CheckpointState.REJECTED:
            raise UnauthorizedRedActionError(
                f"Execution rejected: Action '{action_id}' was explicitly REJECTED by human authority."
            )

        if checkpoint.state != CheckpointState.APPROVED:
            raise UnauthorizedRedActionError(
                f"Execution rejected: Checkpoint '{checkpoint_id}' is not in APPROVED state (current: {checkpoint.state.value})."
            )

        if checkpoint.authorization_token != authorization_token:
            raise UnauthorizedRedActionError(
                "Execution rejected: Provided authorization token does not match checkpoint record."
            )

        if checkpoint.proposal.action_id != action_id:
            raise UnauthorizedRedActionError(
                f"Execution rejected: Token issued for action '{checkpoint.proposal.action_id}', not '{action_id}'."
            )

        if checkpoint.proposal.affected_resource != resource_id:
            raise UnauthorizedRedActionError(
                f"Execution rejected: Token issued for resource '{checkpoint.proposal.affected_resource}', not '{resource_id}'."
            )

        # Mark single-use token as consumed
        checkpoint.token_consumed = True
        return checkpoint

    def execute_and_verify_approved_red_action(
        self,
        checkpoint_id: str,
        authorization_token: str,
        db: Optional[Session] = None,
    ) -> Dict[str, Any]:
        """Execute the consequential mutation in SQLite only after valid authorization, then verify."""
        checkpoint = self.get_checkpoint(checkpoint_id)
        proposal = checkpoint.proposal

        # 1. Validate and consume token
        self.validate_authorization(
            checkpoint_id=checkpoint_id,
            action_id=proposal.action_id,
            resource_id=proposal.affected_resource,
            authorization_token=authorization_token,
        )

        should_close = False
        if db is None:
            db = SessionLocal()
            should_close = True

        now = datetime.now(timezone.utc).isoformat()

        try:
            # 2. Execute the consequential mutation on SQLite (Preempt OR-3)
            room = (
                db.query(OperatingRoomRecord)
                .filter(
                    (OperatingRoomRecord.room_number == proposal.affected_resource)
                    | (OperatingRoomRecord.id == proposal.affected_resource)
                )
                .with_for_update()
                .first()
            )

            if not room:
                raise ResourceNotFoundError(
                    f"Target resource '{proposal.affected_resource}' not found in database."
                )

            previous_state = {
                "status": room.status,
                "scheduled_procedure": room.scheduled_procedure,
                "is_emergency_cleared": room.is_emergency_cleared,
            }

            # Mutate state to unlock trauma surgical capacity
            room.status = "RESERVED_FOR_TRAUMA"
            room.is_emergency_cleared = True
            room.scheduled_procedure = f"POSTPONED: {previous_state['scheduled_procedure']}"
            db.commit()

            # Record audit event for execution
            log_tool_audit(
                db=db,
                tool_name="execute_approved_red_action",
                event_type="CONSEQUENTIAL_ACTION_EXECUTED",
                tier="RED",
                action_id=proposal.action_id,
                details={
                    "checkpoint_id": checkpoint_id,
                    "resource": proposal.affected_resource,
                    "previous_state": previous_state,
                    "new_state": {
                        "status": room.status,
                        "is_emergency_cleared": room.is_emergency_cleared,
                    },
                    "authorized_by": checkpoint.decision_by,
                    "token_consumed": authorization_token,
                },
                incident_id=proposal.incident_id,
                performed_by="AIMBULENCE_EXECUTOR",
            )
            db.commit()

            # 3. Independent Verification: Read database to verify state materialized
            verif_result = verify_operational_status(
                target_entity="operating_room",
                entity_id=room.room_number,
                expected_field="status",
                expected_value="RESERVED_FOR_TRAUMA",
                db=db,
            )

            if not verif_result.get("verified"):
                checkpoint.state = CheckpointState.FAILED
                raise StaleStateError(
                    f"State verification failed: Expected 'RESERVED_FOR_TRAUMA', found '{verif_result.get('actual_value')}'"
                )

            checkpoint.state = CheckpointState.EXECUTED
            checkpoint.executed_at = now
            checkpoint.execution_result = {
                "previous_state": previous_state,
                "new_state": {
                    "status": room.status,
                    "is_emergency_cleared": room.is_emergency_cleared,
                },
                "verified": True,
            }

            return {
                "status": "SUCCESS",
                "checkpoint_id": checkpoint_id,
                "action_id": proposal.action_id,
                "resource": proposal.affected_resource,
                "decision": "APPROVED",
                "authorized_by": checkpoint.decision_by,
                "executed_at": now,
                "previous_state": previous_state,
                "new_state": checkpoint.execution_result["new_state"],
                "verification": verif_result,
                "audit_recorded": True,
            }
        finally:
            if should_close:
                db.close()


# Singleton approval manager instance
approval_manager = TrueForgeApprovalManager()
