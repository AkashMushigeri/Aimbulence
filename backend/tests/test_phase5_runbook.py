"""Comprehensive Automated Test Suite for Phase 5: MCI-01 Runbook Engine.

Tests all requirements:
1. Runbook definition validity (15 steps, ordering, safety tiers).
2. Runbook start and step progression.
3. Shortage calculation for 42 casualties.
4. Operational coordination task creation.
5. Safe resource staging (ED-01, MEDIC-01, OR-2).
6. RED action detection and preemption candidate identification.
7. Pause at TrueForge checkpoint in 'tool.approval_required' state.
8. Persisted WAITING_FOR_APPROVAL state on disk.
9. Rejection path: operator denies, runbook becomes BLOCKED, zero state mutation.
10. Approval path: operator approves, runbook resumes, executes preemption, and completes.
11. State verification post-execution (OR-3 RESERVED_FOR_TRAUMA on disk).
12. Idempotency: completed steps are not duplicated on resume or restart.
13. Restart / resume test: simulates process restart while paused at checkpoint.
14. Final runbook completion and summary generation.
15. FastAPI REST API endpoints (/api/runbooks/mci/start, /{id}, /{id}/resume).
"""
import json
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from backend.app.agent.trueforge_approval_cycle import reset_or3_to_baseline
from backend.app.approval.checkpoint import (
    ApprovalDecisionType,
    CheckpointState,
    approval_manager,
)
from backend.app.main import app
from backend.app.runbooks import (
    MCI_01_STEPS,
    RunbookEngine,
    RunbookState,
    SafetyCategory,
    StepStatus,
    get_mci_01_definition,
    mci_engine,
)
from backend.app.services.database import (
    AmbulanceRecord,
    AuditEventRecord,
    BedRecord,
    IncidentRecord,
    OperatingRoomRecord,
    OperationalTaskRecord,
    RunbookExecutionRecord,
    RunbookStepExecutionRecord,
    SessionLocal,
    init_db,
)
from backend.app.tools.exceptions import StaleStateError


def reset_hospital_test_baseline():
    """Reset hospital resources and approval checkpoints to known baseline."""
    init_db()
    db = SessionLocal()
    try:
        # Reset OR-3
        reset_or3_to_baseline(db=db)

        # Reset OR-2
        or2 = db.query(OperatingRoomRecord).filter(OperatingRoomRecord.room_number == "OR-2").first()
        if or2:
            or2.status = "OPEN"
            or2.is_emergency_cleared = True
            or2.scheduled_procedure = None

        # Reset ED-01
        bed = db.query(BedRecord).filter(BedRecord.bed_code == "ED-01").first()
        if bed:
            bed.is_reserved = False
            bed.is_occupied = False

        # Reset MEDIC-01
        amb = db.query(AmbulanceRecord).filter(AmbulanceRecord.vehicle_code == "MEDIC-01").first()
        if amb:
            amb.status = "AVAILABLE"

        db.commit()
    finally:
        db.close()
    approval_manager.clear()


@pytest.fixture(autouse=True)
def clean_environment():
    """Ensure clean baseline for every test."""
    reset_hospital_test_baseline()
    yield
    reset_hospital_test_baseline()


@pytest.fixture
def test_client():
    """FastAPI TestClient fixture."""
    return TestClient(app)


# ==============================================================================
# 1. RUNBOOK DEFINITION VALIDITY
# ==============================================================================
def test_mci_01_runbook_definition():
    """Verify runbook definition has exactly 15 sequential steps with valid metadata."""
    defn = get_mci_01_definition()
    assert defn.runbook_id == "MCI-01"
    assert len(defn.steps) == 15

    for idx, step in enumerate(defn.steps, start=1):
        assert step.step_number == idx
        assert step.step_id == f"MCI-01-{idx:02d}"
        assert step.name
        assert step.description
        assert step.action_tool
        assert step.safety_category in (SafetyCategory.GREEN, SafetyCategory.YELLOW, SafetyCategory.RED)

    # Verify Step 10 and Step 11 are classified as RED
    assert defn.steps[9].step_id == "MCI-01-10"
    assert defn.steps[9].safety_category == SafetyCategory.RED
    assert defn.steps[10].step_id == "MCI-01-11"
    assert defn.steps[10].safety_category == SafetyCategory.RED


# ==============================================================================
# 2. RUNBOOK START & PAUSE AT TRUEFORGE CHECKPOINT
# ==============================================================================
def test_runbook_start_pauses_at_red_checkpoint():
    """Verify starting runbook executes steps 1-9 and halts at Step 10 TrueForge checkpoint."""
    state = mci_engine.start_runbook(
        incident_id="INC-MCI-42",
        incoming_casualties=42,
    )

    assert state.state == RunbookState.WAITING_FOR_APPROVAL
    assert state.current_step_id == "MCI-01-10"
    assert state.checkpoint_id is not None
    assert state.checkpoint_id.startswith("CHK-")
    assert len(state.completed_steps) == 9  # Steps 1 through 9 completed

    # Verify checkpoint exists in approval manager in PAUSED_FOR_APPROVAL state
    checkpoint = approval_manager.get_checkpoint(state.checkpoint_id)
    assert checkpoint.state == CheckpointState.PAUSED_FOR_APPROVAL
    assert checkpoint.state.value == "tool.approval_required"
    assert checkpoint.proposal.affected_resource == "OR-3"

    # Verify in SQLite database
    db = SessionLocal()
    try:
        persisted = db.query(RunbookExecutionRecord).filter(RunbookExecutionRecord.id == state.execution_id).first()
        assert persisted is not None
        assert persisted.state == "WAITING_FOR_APPROVAL"
        assert persisted.checkpoint_id == state.checkpoint_id
        assert persisted.current_step_id == "MCI-01-10"

        # Check step 10 record in SQLite
        step10_record = (
            db.query(RunbookStepExecutionRecord)
            .filter(
                RunbookStepExecutionRecord.execution_id == state.execution_id,
                RunbookStepExecutionRecord.step_id == "MCI-01-10",
            )
            .first()
        )
        assert step10_record is not None
        assert step10_record.status == "WAITING_FOR_APPROVAL"
    finally:
        db.close()


# ==============================================================================
# 3. VERIFY INDIVIDUAL STEP EXECUTION DETAILS (STEPS 1 - 9)
# ==============================================================================
def test_runbook_pre_checkpoint_steps_execution_details():
    """Verify steps 1 through 9 performed real actions on SQLite."""
    state = mci_engine.start_runbook(incident_id="INC-MCI-42", incoming_casualties=42)

    db = SessionLocal()
    try:
        # Step 1 & 2: Incident exists
        inc = db.query(IncidentRecord).filter(IncidentRecord.id == "INC-MCI-42").first()
        assert inc is not None
        assert inc.casualty_count == 42

        # Step 4: Shortage output exists
        step4_data = state.step_results["MCI-01-04"]["output"]["shortage_analysis"]
        assert step4_data["incoming_casualties"] == 42
        assert step4_data["deficits"]["operating_rooms"] >= 2

        # Step 5: Primary coordination task created
        task_id = state.step_results["MCI-01-05"]["output"]["primary_task_id"]
        persisted_task = db.query(OperationalTaskRecord).filter(OperationalTaskRecord.id == task_id).first()
        assert persisted_task is not None
        assert "MCI Code Black" in persisted_task.title

        # Step 7: Safe resource reservations staged (ED-01, MEDIC-01, OR-2)
        bed = db.query(BedRecord).filter(BedRecord.bed_code == "ED-01").first()
        assert bed.is_reserved is True
        amb = db.query(AmbulanceRecord).filter(AmbulanceRecord.vehicle_code == "MEDIC-01").first()
        assert amb.status == "DISPATCHED"
        or2 = db.query(OperatingRoomRecord).filter(OperatingRoomRecord.room_number == "OR-2").first()
        assert or2.status == "RESERVED_FOR_TRAUMA"

        # OR-3 must REMAIN UNMUTATED at this point
        or3 = db.query(OperatingRoomRecord).filter(OperatingRoomRecord.room_number == "OR-3").first()
        assert or3.status == "IN_USE"
        assert or3.scheduled_procedure == "Elective Arthroscopic Knee Debridement"
    finally:
        db.close()


# ==============================================================================
# 4. REJECTION PATH: OPERATOR DENIES -> RUNBOOK BLOCKED -> NO MUTATION
# ==============================================================================
def test_runbook_rejection_path_blocks_execution():
    """Verify human rejection marks runbook BLOCKED, leaves OR-3 untouched, and writes audit."""
    state = mci_engine.start_runbook(incident_id="INC-MCI-42", incoming_casualties=42)
    checkpoint_id = state.checkpoint_id

    # Operator denies preemption
    approval_manager.submit_decision(
        checkpoint_id=checkpoint_id,
        decision=ApprovalDecisionType.DENY,
        decision_by="Dr. Marcus Vance, Chief Medical Officer",
        reason="Patient in OR-3 has high cardiovascular risk; cancellation aborted.",
    )

    # Resume runbook after denial
    resumed_state = mci_engine.resume_runbook(execution_id=state.execution_id)

    assert resumed_state.state == RunbookState.BLOCKED
    assert resumed_state.current_step_id == "MCI-01-11"
    assert "REJECTED by Dr. Marcus Vance" in resumed_state.error_message

    # Ensure OR-3 remained completely unmutated in SQLite
    db = SessionLocal()
    try:
        or3 = db.query(OperatingRoomRecord).filter(OperatingRoomRecord.room_number == "OR-3").first()
        assert or3.status == "IN_USE"
        assert or3.scheduled_procedure == "Elective Arthroscopic Knee Debridement"
        assert or3.is_emergency_cleared is False

        # Verify step 11 is BLOCKED
        step11 = (
            db.query(RunbookStepExecutionRecord)
            .filter(
                RunbookStepExecutionRecord.execution_id == state.execution_id,
                RunbookStepExecutionRecord.step_id == "MCI-01-11",
            )
            .first()
        )
        assert step11.status == "BLOCKED"
    finally:
        db.close()


# ==============================================================================
# 5. APPROVAL PATH: OPERATOR ALLOWS -> RESUMES -> COMPLETES ALL 15 STEPS
# ==============================================================================
def test_runbook_approval_path_executes_and_completes():
    """Verify human approval allows runbook to execute preemption, verify disk state, and complete all 15 steps."""
    state = mci_engine.start_runbook(incident_id="INC-MCI-42", incoming_casualties=42)
    checkpoint_id = state.checkpoint_id

    # Operator authorizes preemption
    approval_manager.submit_decision(
        checkpoint_id=checkpoint_id,
        decision=ApprovalDecisionType.ALLOW,
        decision_by="Dr. Eleanor Vance, Trauma Medical Director",
        reason="Surgery held in pre-op holding area; room cleared for mass-casualty conversion.",
    )

    # Resume runbook after authorization
    resumed_state = mci_engine.resume_runbook(execution_id=state.execution_id)

    assert resumed_state.state == RunbookState.COMPLETED
    assert resumed_state.current_step_id == "MCI-01-15"
    assert len(resumed_state.completed_steps) == 15
    assert resumed_state.completed_at is not None

    # Verify Step 11 mutated OR-3 in SQLite
    db = SessionLocal()
    try:
        or3 = db.query(OperatingRoomRecord).filter(OperatingRoomRecord.room_number == "OR-3").first()
        assert or3.status == "RESERVED_FOR_TRAUMA"
        assert or3.is_emergency_cleared is True
        assert "POSTPONED" in or3.scheduled_procedure

        # Verify Step 12 verification result
        step12_output = resumed_state.step_results["MCI-01-12"]["output"]["verification_result"]
        assert step12_output["verified"] is True
        assert step12_output["actual_value"] == "RESERVED_FOR_TRAUMA"

        # Verify Step 14 follow-up tasks were created
        followup_tasks = resumed_state.step_results["MCI-01-14"]["output"]["followup_tasks"]
        assert len(followup_tasks) == 2
        for tid in followup_tasks:
            t = db.query(OperationalTaskRecord).filter(OperationalTaskRecord.id == tid).first()
            assert t is not None

        # Verify Step 15 summary
        summary = resumed_state.summary
        assert summary is not None
        assert summary["runbook_id"] == "MCI-01"
        assert summary["final_status"] == "COMPLETED"
        assert "OR-3" in summary["staged_resources"]
    finally:
        db.close()


# ==============================================================================
# 6. IDEMPOTENCY: ALREADY COMPLETED STEPS ARE NOT DUPLICATED
# ==============================================================================
def test_runbook_step_idempotency():
    """Verify calling resume multiple times does not duplicate completed steps or side effects."""
    state = mci_engine.start_runbook(incident_id="INC-MCI-42", incoming_casualties=42)
    checkpoint_id = state.checkpoint_id

    # Authorize and complete
    approval_manager.submit_decision(
        checkpoint_id=checkpoint_id,
        decision=ApprovalDecisionType.ALLOW,
        decision_by="Dr. Eleanor Vance",
    )
    resumed1 = mci_engine.resume_runbook(execution_id=state.execution_id)
    assert resumed1.state == RunbookState.COMPLETED

    db = SessionLocal()
    try:
        # Count total steps for this execution — must be exactly 15
        total_steps = (
            db.query(RunbookStepExecutionRecord)
            .filter(RunbookStepExecutionRecord.execution_id == state.execution_id)
            .count()
        )
        assert total_steps == 15

        # Re-attempting resume on completed runbook raises StaleStateError
        with pytest.raises(StaleStateError):
            mci_engine.resume_runbook(execution_id=state.execution_id)
    finally:
        db.close()


# ==============================================================================
# 7. RESTART / RESUME TEST (PROCESS SHUTDOWN & RECONNECTION)
# ==============================================================================
def test_runbook_survives_process_restart():
    """Verify runbook state survives application restart, reconnects to checkpoint, and resumes."""
    # 1. Start runbook
    initial_engine = RunbookEngine()
    state = initial_engine.start_runbook(incident_id="INC-MCI-RESTART", incoming_casualties=42)
    execution_id = state.execution_id
    checkpoint_id = state.checkpoint_id

    # 2. Simulate complete application restart (create fresh RunbookEngine instance)
    restarted_engine = RunbookEngine()

    # Query execution state through new instance
    recovered_state = restarted_engine.get_execution_state(execution_id=execution_id)
    assert recovered_state.execution_id == execution_id
    assert recovered_state.state == RunbookState.WAITING_FOR_APPROVAL
    assert recovered_state.checkpoint_id == checkpoint_id
    assert len(recovered_state.completed_steps) == 9

    # Verify OR-3 is still UNMUTATED
    db = SessionLocal()
    try:
        or3 = db.query(OperatingRoomRecord).filter(OperatingRoomRecord.room_number == "OR-3").first()
        assert or3.status == "IN_USE"
    finally:
        db.close()

    # 3. Approve checkpoint in new environment
    approval_manager.submit_decision(
        checkpoint_id=checkpoint_id,
        decision=ApprovalDecisionType.ALLOW,
        decision_by="Dr. Emergency Restart Specialist",
    )

    # 4. Resume through restarted engine
    final_state = restarted_engine.resume_runbook(execution_id=execution_id)
    assert final_state.state == RunbookState.COMPLETED
    assert len(final_state.completed_steps) == 15

    # Confirm mutation persisted on disk
    db = SessionLocal()
    try:
        or3_final = db.query(OperatingRoomRecord).filter(OperatingRoomRecord.room_number == "OR-3").first()
        assert or3_final.status == "RESERVED_FOR_TRAUMA"
    finally:
        db.close()


# ==============================================================================
# 8. REST API ENDPOINTS (/api/runbooks/...)
# ==============================================================================
def test_runbook_rest_api_endpoints(test_client):
    """Verify REST endpoints for starting, querying, and resuming runbooks."""
    # 1. Start runbook via POST /api/runbooks/mci/start
    start_payload = {
        "incident_id": "INC-MCI-REST-API",
        "incoming_casualties": 42,
        "acute_ratio": 0.5,
    }
    start_res = test_client.post("/api/runbooks/mci/start", json=start_payload)
    assert start_res.status_code == 201
    start_data = start_res.json()
    execution_id = start_data["runbook_execution_id"]
    checkpoint_id = start_data["checkpoint_id"]
    assert start_data["state"] == "WAITING_FOR_APPROVAL"
    assert checkpoint_id is not None

    # 2. Query execution status via GET /api/runbooks/{execution_id}
    get_res = test_client.get(f"/api/runbooks/{execution_id}")
    assert get_res.status_code == 200
    exec_data = get_res.json()
    assert exec_data["execution_id"] == execution_id
    assert exec_data["state"] == "WAITING_FOR_APPROVAL"
    assert len(exec_data["completed_steps"]) == 9

    # 3. Attempt resume BEFORE human decision — must fail with 409
    premature_resume = test_client.post(f"/api/runbooks/{execution_id}/resume", json={})
    assert premature_resume.status_code == 409
    assert "awaiting human decision" in premature_resume.json()["detail"]

    # 4. Human approves checkpoint via Phase 4 endpoint POST /api/approval/decide
    decide_res = test_client.post(
        "/api/approval/decide",
        json={
            "checkpoint_id": checkpoint_id,
            "decision": "allow",
            "decision_by": "Dr. REST Chief",
            "reason": "REST API authorization",
            "execute_if_approved": False,  # Engine will execute step 11
        },
    )
    assert decide_res.status_code == 200

    # 5. Resume runbook via POST /api/runbooks/{execution_id}/resume
    resume_res = test_client.post(
        f"/api/runbooks/{execution_id}/resume",
        json={"reason": "Operator signed off in REST API"},
    )
    assert resume_res.status_code == 200
    completed_data = resume_res.json()
    assert completed_data["state"] == "COMPLETED"
    assert len(completed_data["completed_steps"]) == 15
    assert completed_data["summary"] is not None
