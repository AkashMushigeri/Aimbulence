"""Runbook Execution API Endpoints.

Provides REST endpoints for starting, querying, and resuming the MCI-01
operational runbook under TrueForge safety governance.
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.runbooks.engine import mci_engine
from backend.app.runbooks.models import (
    ResumeRunbookRequest,
    RunbookExecutionState,
    StartRunbookRequest,
    StartRunbookResponse,
)
from backend.app.services.database import get_db
from backend.app.tools.exceptions import (
    ResourceNotFoundError,
    StaleStateError,
    UnauthorizedRedActionError,
)

router = APIRouter(prefix="/runbooks", tags=["Runbooks"])


@router.post(
    "/mci/start",
    response_model=StartRunbookResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Start an MCI-01 operational runbook execution",
)
def start_mci_runbook(
    payload: StartRunbookRequest,
    db: Session = Depends(get_db),
):
    """Initiates the 15-step MCI-01 Mass Casualty Incident operational surge runbook.

    Executes through safe automated staging steps until reaching the TrueForge
    approval checkpoint for consequential operating room preemption.
    """
    try:
        execution_state = mci_engine.start_runbook(
            incident_id=payload.incident_id,
            incoming_casualties=payload.incoming_casualties,
            acute_ratio=payload.acute_ratio,
            db=db,
        )

        return StartRunbookResponse(
            runbook_execution_id=execution_state.execution_id,
            runbook_id=execution_state.runbook_id,
            incident_id=execution_state.incident_id,
            state=execution_state.state,
            current_step=execution_state.current_step_id,
            checkpoint_id=execution_state.checkpoint_id,
            message=(
                f"Runbook initiated. Current state: {execution_state.state.value} at step {execution_state.current_step_id}."
            ),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to initiate runbook: {str(e)}",
        )


@router.get(
    "/{execution_id}",
    response_model=RunbookExecutionState,
    summary="Retrieve runbook execution status and step history",
)
def get_runbook_execution(
    execution_id: str,
    db: Session = Depends(get_db),
):
    """Retrieve full execution status, completed steps, outputs, and checkpoint details."""
    try:
        return mci_engine.get_execution_state(execution_id=execution_id, db=db)
    except ResourceNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post(
    "/{execution_id}/resume",
    response_model=RunbookExecutionState,
    summary="Resume a paused runbook after TrueForge checkpoint resolution",
)
def resume_runbook_execution(
    execution_id: str,
    payload: Optional[ResumeRunbookRequest] = None,
    db: Session = Depends(get_db),
):
    """Resumes execution of a runbook that paused at a TrueForge approval checkpoint.

    Can only be resumed after the human operator has submitted an authorization
    decision (allow / deny) through the Phase 4 approval interface.
    """
    try:
        reason = payload.reason if payload else None
        return mci_engine.resume_runbook(execution_id=execution_id, reason=reason, db=db)
    except ResourceNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except StaleStateError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except UnauthorizedRedActionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
