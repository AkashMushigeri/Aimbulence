"""TrueForge Human-in-the-Loop Approval Checkpoint API Endpoints.

Provides REST endpoints for querying, creating, deciding, and executing
high-consequence (RED) hospital operational checkpoints under TrueForge governance.
"""
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.app.approval.checkpoint import (
    ApprovalDecisionPayload,
    ApprovalDecisionType,
    CheckpointState,
    RedActionProposal,
    TrueForgeApprovalCheckpoint,
    approval_manager,
)
from backend.app.services.database import get_db
from backend.app.tools.exceptions import (
    ResourceNotFoundError,
    StaleStateError,
    UnauthorizedRedActionError,
)

router = APIRouter(prefix="/approval", tags=["TrueForge Approval Checkpoints"])


class DecideRequest(BaseModel):
    """Payload for submitting an approval decision."""
    checkpoint_id: str = Field(..., description="Checkpoint ID to resolve")
    decision: ApprovalDecisionType = Field(..., description="allow / APPROVE or deny / REJECT")
    decision_by: str = Field(..., min_length=2, description="Authorizing human operator or authority")
    reason: Optional[str] = Field(default=None, description="Clinical or command reasoning")
    execute_if_approved: bool = Field(
        default=True,
        description="Whether to immediately execute and verify consequential mutation if decision is approved",
    )


class ExecuteActionRequest(BaseModel):
    """Payload for executing an approved RED consequential action."""
    authorization_token: str = Field(..., description="Single-use cryptographic authorization token")


@router.get(
    "/checkpoints",
    response_model=List[TrueForgeApprovalCheckpoint],
    summary="List all TrueForge approval checkpoints",
)
def list_checkpoints(
    state: Optional[str] = Query(None, description="Filter by state (e.g. tool.approval_required, APPROVED, REJECTED, EXECUTED)"),
):
    """Retrieve all operational checkpoints currently tracked by the TrueForge approval manager."""
    all_checkpoints = approval_manager.list_checkpoints()
    if state:
        return [cp for cp in all_checkpoints if cp.state.value == state or cp.state.name == state]
    return all_checkpoints


@router.get(
    "/checkpoints/{checkpoint_id}",
    response_model=TrueForgeApprovalCheckpoint,
    summary="Get details for a specific approval checkpoint",
)
def get_checkpoint(checkpoint_id: str):
    """Retrieve a specific checkpoint by ID."""
    try:
        return approval_manager.get_checkpoint(checkpoint_id)
    except ResourceNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post(
    "/propose",
    response_model=TrueForgeApprovalCheckpoint,
    status_code=status.HTTP_201_CREATED,
    summary="Propose a RED consequential action and halt at TrueForge checkpoint",
)
def propose_red_action(
    proposal: RedActionProposal,
    thread_id: str = Query(default="thread-mci-42", description="TrueForge execution thread ID"),
    db: Session = Depends(get_db),
):
    """Creates a RED consequential action proposal and immediately pauses execution

    at a TrueForge approval checkpoint awaiting human operator decision.
    """
    checkpoint = approval_manager.pause_for_approval(
        proposal=proposal,
        thread_id=thread_id,
        db=db,
    )
    return checkpoint


@router.post(
    "/decide",
    summary="Submit human decision for a checkpoint (with optional immediate execution)",
)
def decide_checkpoint(
    payload: DecideRequest,
    db: Session = Depends(get_db),
):
    """Submit operator decision (allow / deny).

    If approved and `execute_if_approved` is True, executes the consequential mutation,
    independently verifies SQLite state, and logs the immutable audit trail.
    """
    try:
        checkpoint = approval_manager.submit_decision(
            checkpoint_id=payload.checkpoint_id,
            decision=payload.decision,
            decision_by=payload.decision_by,
            reason=payload.reason,
            db=db,
        )

        execution_result = None
        if checkpoint.state == CheckpointState.APPROVED and payload.execute_if_approved:
            execution_result = approval_manager.execute_and_verify_approved_red_action(
                checkpoint_id=payload.checkpoint_id,
                authorization_token=checkpoint.authorization_token,
                db=db,
            )

        return {
            "status": "DECIDED",
            "checkpoint": checkpoint,
            "execution": execution_result,
        }
    except ResourceNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except StaleStateError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except UnauthorizedRedActionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))


@router.post(
    "/checkpoints/{checkpoint_id}/decide",
    response_model=TrueForgeApprovalCheckpoint,
    summary="Submit decision for a specific checkpoint",
)
def decide_checkpoint_by_id(
    checkpoint_id: str,
    payload: ApprovalDecisionPayload,
    db: Session = Depends(get_db),
):
    """Records human operator approval or denial for the specified checkpoint."""
    try:
        return approval_manager.submit_decision(
            checkpoint_id=checkpoint_id,
            decision=payload.decision,
            decision_by=payload.decision_by,
            reason=payload.reason,
            db=db,
        )
    except ResourceNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except StaleStateError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))


@router.post(
    "/checkpoints/{checkpoint_id}/execute",
    summary="Execute consequential mutation with valid authorization token",
)
def execute_approved_action(
    checkpoint_id: str,
    payload: ExecuteActionRequest,
    db: Session = Depends(get_db),
):
    """Executes the consequential action in SQLite, consumes single-use token,

    and performs post-execution verification.
    """
    try:
        result = approval_manager.execute_and_verify_approved_red_action(
            checkpoint_id=checkpoint_id,
            authorization_token=payload.authorization_token,
            db=db,
        )
        return result
    except ResourceNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except StaleStateError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except UnauthorizedRedActionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
