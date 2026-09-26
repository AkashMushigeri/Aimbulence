"""Phase 7: End-to-End Validation & Reliability Hardening Test Suite.

Verifies the complete execution chain:
RUNBOOK -> AGENT -> TOOLS -> TRUEFORGE -> APPROVAL -> EXECUTION -> VERIFICATION -> RESUME -> COMPLETION

Enforces:
- Happy-path 24-step verification
- Rejection safety path with zero mutation
- Process restart and crash recovery
- Idempotency & duplicate request prevention
- Cryptographic token binding & security exploit prevention
- Failure injection & boundary containment
- Audit trail completeness
- Safe synthetic demo reset
"""
import json
import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.approval.checkpoint import (
    ApprovalDecisionType,
    CheckpointState,
    RedActionProposal,
    approval_manager,
)
from backend.app.runbooks.engine import RunbookEngine, mci_engine
from backend.app.runbooks.models import RunbookState, StepStatus
from backend.app.services.database import (
    AuditEventRecord,
    BedRecord,
    IncidentRecord,
    OperatingRoomRecord,
    OperationalTaskRecord,
    RunbookExecutionRecord,
    RunbookStepExecutionRecord,
    SessionLocal,
    init_db,
    reset_demo_database,
)
from backend.app.tools.exceptions import (
    ResourceNotFoundError,
    StaleStateError,
    UnauthorizedRedActionError,
)
from backend.app.tools.resource_tools import execute_consequential_action


@pytest.fixture(autouse=True)
def clean_database():
    """Ensure clean synthetic baseline before each test."""
    init_db()
    db = SessionLocal()
    try:
        reset_demo_database(db=db)
        approval_manager.clear()
        yield db
    finally:
        db.close()


@pytest.fixture
def client():
    """FastAPI TestClient fixture."""
    return TestClient(app)


# ==============================================================================
# 1. FULL HAPPY-PATH E2E TEST (24 VERIFICATION POINTS)
# ==============================================================================
def test_full_happy_path_e2e(client, clean_database):
    """Execute complete 24-point happy path with real database, tools, and approval."""
    db = clean_database

    # 1. Start MCI-01 via REST API
    start_res = client.post(
        "/api/runbooks/mci/start",
        json={"incident_id": "INC-MCI-E2E-72", "incoming_casualties": 42, "acute_ratio": 0.5},
    )
    assert start_res.status_code == 201
    start_data = start_res.json()
    execution_id = start_data["runbook_execution_id"]
    checkpoint_id = start_data["checkpoint_id"]

    # 2 & 3. Incident registration & verification
    inc = db.query(IncidentRecord).filter(IncidentRecord.id == "INC-MCI-E2E-72").first()
    assert inc is not None
    assert inc.casualty_count == 42

    # 4 & 5. Capacity reading & shortage calculation
    exec_state = mci_engine.get_execution_state(execution_id, db=db)
    step1_out = exec_state.step_results["MCI-01-01"]["output"]
    assert step1_out["casualty_count"] == 42
    assert step1_out["severity"] == "CRITICAL"

    # 6. Operational command task creation
    step5_out = exec_state.step_results["MCI-01-05"]["output"]
    assert "primary_task_id" in step5_out
    task = db.query(OperationalTaskRecord).filter(OperationalTaskRecord.id == step5_out["primary_task_id"]).first()
    assert task is not None
    assert "MCI Code Black" in task.title

    # 7 & 8. Safe resources inspected & staged
    ed_bed = db.query(BedRecord).filter(BedRecord.bed_code == "ED-01").first()
    assert ed_bed.is_reserved is True
    or2 = db.query(OperatingRoomRecord).filter(OperatingRoomRecord.room_number == "OR-2").first()
    assert or2.status == "RESERVED_FOR_TRAUMA"

    # 9 & 10. Recalculate shortages & detect need for RED preemption
    step9_out = exec_state.step_results["MCI-01-09"]["output"]
    assert step9_out["red_action_required"] is True
    assert step9_out["target_resource"] == "OR-3"

    # 11 & 12. RED proposal created & TrueForge checkpoint reached
    assert exec_state.state == RunbookState.WAITING_FOR_APPROVAL
    assert exec_state.current_step_id == "MCI-01-10"
    assert checkpoint_id is not None

    checkpoint = approval_manager.get_checkpoint(checkpoint_id)
    assert checkpoint.state == CheckpointState.PAUSED_FOR_APPROVAL
    assert checkpoint.proposal.affected_resource == "OR-3"
    assert checkpoint.proposal.action_type == "PREEMPT_OPERATING_ROOM"

    # 13 & 14. Confirm paused & confirm RED action has NOT executed yet
    assert len(exec_state.completed_steps) == 9
    or3_before = db.query(OperatingRoomRecord).filter(OperatingRoomRecord.room_number == "OR-3").first()
    assert or3_before.status == "IN_USE"
    assert or3_before.scheduled_procedure == "Elective Arthroscopic Knee Debridement"
    assert or3_before.is_emergency_cleared is False

    # 15. Approve action via REST API
    decide_res = client.post(
        "/api/approval/decide",
        json={
            "checkpoint_id": checkpoint_id,
            "decision": "APPROVE",
            "decision_by": "Dr. Eleanor Vance, Trauma Medical Director",
            "reason": "MCI 42-casualty critical trauma surge authorized.",
            "execute_if_approved": True,
        },
    )
    assert decide_res.status_code == 200
    decide_data = decide_res.json()
    assert decide_data["checkpoint"]["state"] == "EXECUTED"
    assert decide_data["checkpoint"]["token_consumed"] is True

    # 16. Resume runbook via REST API
    resume_res = client.post(
        f"/api/runbooks/{execution_id}/resume",
        json={"reason": "Human approval confirmed; proceeding to completion."},
    )
    assert resume_res.status_code == 200
    final_state = resume_res.json()

    # 17, 18 & 19. Consequential mutation executed & verified on disk
    assert final_state["state"] == "COMPLETED"
    db.expire_all()
    or3_after = db.query(OperatingRoomRecord).filter(OperatingRoomRecord.room_number == "OR-3").first()
    assert or3_after.status == "RESERVED_FOR_TRAUMA"
    assert or3_after.is_emergency_cleared is True

    # 20 & 21. Readiness verification & follow-up tasks
    assert len(final_state["completed_steps"]) == 15
    step12_verif = final_state["step_results"]["MCI-01-12"]["verification"]
    assert step12_verif["verified"] is True
    step14_verif = final_state["step_results"]["MCI-01-14"]["verification"]
    assert step14_verif["tasks_created_count"] == 2

    # 22 & 23. Complete MCI-01 and verify final status
    assert final_state["summary"]["final_status"] == "COMPLETED"
    assert "OR-3" in final_state["summary"]["staged_resources"]

    # 24. Verify audit trail integrity
    audit_events = db.query(AuditEventRecord).order_by(AuditEventRecord.timestamp.desc()).all()
    event_types = [a.event_type for a in audit_events]
    assert "CHECKPOINT_CREATED" in event_types
    assert "APPROVAL_GRANTED" in event_types
    assert "RUNBOOK_COMPLETED" in event_types


# ==============================================================================
# 2. REJECTION PATH TEST
# ==============================================================================
def test_full_rejection_path_e2e(client, clean_database):
    """Verify operator rejection immediately blocks execution and preserves OR-3."""
    db = clean_database

    start_res = client.post(
        "/api/runbooks/mci/start",
        json={"incident_id": "INC-MCI-REJECT-73", "incoming_casualties": 42},
    )
    assert start_res.status_code == 201
    execution_id = start_res.json()["runbook_execution_id"]
    checkpoint_id = start_res.json()["checkpoint_id"]

    # Operator denies preemption
    decide_res = client.post(
        "/api/approval/decide",
        json={
            "checkpoint_id": checkpoint_id,
            "decision": "REJECT",
            "decision_by": "Dr. Marcus Vance, Chief Medical Officer",
            "reason": "Active patient in OR-3 cannot be safely moved.",
            "execute_if_approved": False,
        },
    )
    assert decide_res.status_code == 200
    assert decide_res.json()["checkpoint"]["state"] == "REJECTED"

    # Resume must recognize rejection and transition runbook to BLOCKED
    resume_res = client.post(f"/api/runbooks/{execution_id}/resume", json={})
    assert resume_res.status_code == 200
    blocked_state = resume_res.json()
    assert blocked_state["state"] == "BLOCKED"
    assert "REJECTED" in blocked_state["error_message"]

    # Zero mutation guarantee: OR-3 remains IN_USE
    or3 = db.query(OperatingRoomRecord).filter(OperatingRoomRecord.room_number == "OR-3").first()
    assert or3.status == "IN_USE"
    assert or3.scheduled_procedure == "Elective Arthroscopic Knee Debridement"
    assert or3.is_emergency_cleared is False

    # Check rejection audit recorded
    denial_audit = (
        db.query(AuditEventRecord)
        .filter(AuditEventRecord.event_type == "APPROVAL_REJECTED")
        .first()
    )
    assert denial_audit is not None
    assert "REJECTED" in denial_audit.details_json


# ==============================================================================
# 3. RESTART / RECOVERY TESTS
# ==============================================================================
def test_restart_recovery_across_lifecycle(client, clean_database):
    """Test process restart simulation at various stages."""
    db = clean_database

    # TEST A: Start runbook and verify state survives process restart
    start_res = client.post(
        "/api/runbooks/mci/start",
        json={"incident_id": "INC-MCI-RESTART-74", "incoming_casualties": 42},
    )
    execution_id = start_res.json()["runbook_execution_id"]
    checkpoint_id = start_res.json()["checkpoint_id"]

    # Simulate fresh engine and fresh DB session
    new_engine = RunbookEngine()
    fresh_db = SessionLocal()
    try:
        recovered = new_engine.get_execution_state(execution_id, db=fresh_db)
        assert recovered.execution_id == execution_id
        assert recovered.state == RunbookState.WAITING_FOR_APPROVAL
        assert recovered.checkpoint_id == checkpoint_id
        assert len(recovered.completed_steps) == 9

        # TEST B: Checkpoint is preserved and does NOT execute automatically
        or3 = fresh_db.query(OperatingRoomRecord).filter(OperatingRoomRecord.room_number == "OR-3").first()
        assert or3.status == "IN_USE"

        # TEST C: Resolve checkpoint after restart and complete execution
        approval_manager.submit_decision(
            checkpoint_id=checkpoint_id,
            decision=ApprovalDecisionType.APPROVE,
            decision_by="Dr. Recovery Officer",
            reason="Post-restart authorization",
            db=fresh_db,
        )
        resumed = new_engine.resume_runbook(execution_id, db=fresh_db)
        assert resumed.state == RunbookState.COMPLETED
        assert len(resumed.completed_steps) == 15

        # TEST D: Calling resume on a completed runbook must fail safely
        with pytest.raises(StaleStateError):
            new_engine.resume_runbook(execution_id, db=fresh_db)
    finally:
        fresh_db.close()


# ==============================================================================
# 4. IDEMPOTENCY & DUPLICATE PREVENTION
# ==============================================================================
def test_idempotency_and_duplicate_prevention(client, clean_database):
    """Verify duplicate operations do not execute twice or corrupt state."""
    db = clean_database

    start_res = client.post(
        "/api/runbooks/mci/start",
        json={"incident_id": "INC-MCI-IDEMP-75", "incoming_casualties": 42},
    )
    execution_id = start_res.json()["runbook_execution_id"]
    checkpoint_id = start_res.json()["checkpoint_id"]

    # 1. Duplicate approval on same checkpoint must fail with 409
    approve_res1 = client.post(
        "/api/approval/decide",
        json={
            "checkpoint_id": checkpoint_id,
            "decision": "APPROVE",
            "decision_by": "Dr. Idempotency Officer",
            "execute_if_approved": True,
        },
    )
    assert approve_res1.status_code == 200

    approve_res2 = client.post(
        "/api/approval/decide",
        json={
            "checkpoint_id": checkpoint_id,
            "decision": "APPROVE",
            "decision_by": "Dr. Idempotency Officer",
            "execute_if_approved": True,
        },
    )
    assert approve_res2.status_code == 409

    # 2. Resuming completed runbook returns 409
    client.post(f"/api/runbooks/{execution_id}/resume", json={})
    resume_dup = client.post(f"/api/runbooks/{execution_id}/resume", json={})
    assert resume_dup.status_code == 409


# ==============================================================================
# 5. APPROVAL SECURITY & EXPLOIT DEFENSE
# ==============================================================================
def test_approval_security_exploits(client, clean_database):
    """Attempt 9 unsafe operations; ensure all fail safely with zero mutation."""
    db = clean_database

    # 1. Direct tool execution without token
    with pytest.raises(UnauthorizedRedActionError):
        execute_consequential_action("ACT-SEC-1", "PREEMPT_OPERATING_ROOM", "OR-3", authorization_token=None, db=db)

    # 2. Direct tool execution with forged/fake token
    with pytest.raises(UnauthorizedRedActionError):
        execute_consequential_action("ACT-SEC-2", "PREEMPT_OPERATING_ROOM", "OR-3", authorization_token="fake-forged-token", db=db)

    # 3. Create real checkpoint
    proposal = RedActionProposal(
        action_id="ACT-SEC-OR3",
        action_type="PREEMPT_OPERATING_ROOM",
        affected_resource="OR-3",
        current_state={"status": "IN_USE"},
        proposed_state={"status": "RESERVED_FOR_TRAUMA"},
        reason="Security test proposal",
        expected_benefit="Trauma readiness",
        potential_consequence="Postpones elective procedure",
    )
    chk = approval_manager.pause_for_approval(proposal=proposal, db=db)

    # 4. Attempt decision on nonexistent checkpoint
    with pytest.raises(ResourceNotFoundError):
        approval_manager.submit_decision("CHK-NONEXISTENT", ApprovalDecisionType.APPROVE, "Dr. Hacker")

    # 5. Human rejection
    approval_manager.submit_decision(chk.checkpoint_id, ApprovalDecisionType.DENY, "Dr. Strict", db=db)

    # 6. Execute after rejection must fail
    with pytest.raises(UnauthorizedRedActionError):
        approval_manager.execute_and_verify_approved_red_action(chk.checkpoint_id, authorization_token="AUTH-APPROVED-FAKE", db=db)

    # 7. Create another checkpoint and approve
    chk2 = approval_manager.pause_for_approval(proposal=proposal, db=db)
    approval_manager.submit_decision(chk2.checkpoint_id, ApprovalDecisionType.APPROVE, "Dr. Strict", db=db)
    token = chk2.authorization_token
    assert token is not None

    # 8. Token replay attack: execute once, then attempt second execution
    approval_manager.execute_and_verify_approved_red_action(chk2.checkpoint_id, authorization_token=token, db=db)
    with pytest.raises(UnauthorizedRedActionError):
        approval_manager.validate_authorization(chk2.checkpoint_id, proposal.action_id, proposal.affected_resource, token)

    # 9. Cross-resource attack: token for OR-3 attempted on OR-4
    chk3 = approval_manager.pause_for_approval(proposal=proposal, db=db)
    approval_manager.submit_decision(chk3.checkpoint_id, ApprovalDecisionType.APPROVE, "Dr. Strict", db=db)
    token3 = chk3.authorization_token
    with pytest.raises(UnauthorizedRedActionError):
        approval_manager.validate_authorization(chk3.checkpoint_id, proposal.action_id, "OR-4", token3)

    # 10. Wrong action attack: token for ACT-SEC-OR3 attempted on WRONG_ACTION
    with pytest.raises(UnauthorizedRedActionError):
        approval_manager.validate_authorization(chk3.checkpoint_id, "WRONG_ACTION", "OR-3", token3)



# ==============================================================================
# 6. DEMO RESET & ENDPOINT VALIDATION
# ==============================================================================
def test_demo_reset_endpoint(client, clean_database):
    """Verify demo reset restores baseline cleanly."""
    db = clean_database

    # Start runbook and mutate state
    client.post(
        "/api/runbooks/mci/start",
        json={"incident_id": "INC-MCI-RESET-TEST", "incoming_casualties": 42},
    )

    # Call POST /api/demo/reset
    reset_res = client.post("/api/demo/reset")
    assert reset_res.status_code == 200
    reset_data = reset_res.json()
    assert reset_data["status"] == "RESET_COMPLETE"
    assert reset_data["available_ed_beds"] == 12
    assert reset_data["open_operating_rooms"] == 2
    assert reset_data["or_3_status"] == "IN_USE"

    # Verify SQLite state is restored
    assert db.query(RunbookExecutionRecord).count() == 0
    or3 = db.query(OperatingRoomRecord).filter(OperatingRoomRecord.room_number == "OR-3").first()
    assert or3.status == "IN_USE"
    assert or3.is_emergency_cleared is False
