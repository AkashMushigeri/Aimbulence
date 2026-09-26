"""Health check endpoint."""
import os
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from backend.app.services.database import get_db

router = APIRouter(prefix="/health", tags=["Health"])


@router.get("", summary="System health and connectivity check")
def get_health(db: Session = Depends(get_db)):
    """Returns application status, database connectivity, and timestamp."""
    try:
        # Verify active database connection
        db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail={"status": "unhealthy", "database": f"connection failed: {str(exc)}"}
        )

    return {
        "status": "healthy",
        "service": "aimbulence-backend",
        "database": db_status,
        "environment": os.getenv("APP_ENV", "development"),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
