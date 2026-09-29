"""AIMBULENCE FastAPI Application Entry Point."""
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

from backend.app.api.routes import approval, demo, health, hospital, incidents, prearrival, runbooks
from backend.app.services.database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan context: initialize database schema and seed baseline."""
    init_db()
    yield


app = FastAPI(
    title="AIMBULENCE API",
    description="Emergency Hospital Operations Runbook Executor — Phase 1 Backend Foundation & API Contracts",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS Middleware to support local Member 2 frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Return structured, sanitized validation error messages."""
    errors = []
    for err in exc.errors():
        loc = " -> ".join(str(l) for l in err.get("loc", []))
        errors.append({"field": loc, "message": err.get("msg"), "type": err.get("type")})
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": "Request validation failed", "errors": errors},
    )


# Mount API Routes under /api
app.include_router(health.router, prefix="/api")
app.include_router(hospital.router, prefix="/api")
app.include_router(incidents.router, prefix="/api")
app.include_router(approval.router, prefix="/api")
app.include_router(prearrival.router, prefix="/api")
app.include_router(runbooks.router, prefix="/api")
app.include_router(demo.router, prefix="/api")





@app.get("/", summary="Root index")
def read_root():
    """Service status and contract documentation link."""
    return {
        "service": "AIMBULENCE API",
        "description": "AI Emergency Hospital Operations Runbook Executor",
        "phase": "PHASE 1 — BACKEND FOUNDATION + API CONTRACT",
        "docs_url": "/docs",
        "health_check": "/api/health",
        "note": "Agent execution, TrueForge runtime, and runbook loops are reserved for subsequent phases.",
    }
