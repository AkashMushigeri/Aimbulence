"""Demo-only reset endpoints for live hackathon evaluation."""
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from backend.app.approval.checkpoint import approval_manager
from backend.app.services.database import get_db, reset_demo_database

router = APIRouter(prefix="/demo", tags=["Demo"])


@router.post(
    "/reset",
    status_code=status.HTTP_200_OK,
    summary="Reset synthetic hospital state to baseline (DEMO-ONLY)",
)
def reset_demo(db: Session = Depends(get_db)):
    """DEMO-ONLY endpoint that safely restores synthetic database baseline.

    - Clears active runbook executions and completed steps.
    - Clears open tasks and incidents.
    - Resets beds, operating rooms (OR-3 to IN_USE), staff, ambulances, and blood.
    - Resets TrueForge checkpoint memory registry.
    """
    reset_demo_database(db=db)
    approval_manager.clear()
    return {
        "status": "RESET_COMPLETE",
        "message": "Synthetic hospital state and TrueForge harness safely reset to baseline.",
        "hospital_code": "NORMAL",
        "available_ed_beds": 12,
        "available_icu_beds": 4,
        "open_operating_rooms": 2,
        "or_3_status": "IN_USE",
    }
