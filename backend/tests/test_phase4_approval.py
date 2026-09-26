"""Automated test suite for Phase 4: TrueForge Human-in-the-Loop Approval Checkpoints.

Tests all requirements:
1. RED action proposal creates a checkpoint in 'tool.approval_required' state.
2. Direct execution without valid token is blocked with UnauthorizedRedActionError.
3. Human rejection (deny/REJECT) marks checkpoint REJECTED and preserves original SQLite state.
4. Human approval (allow/APPROVE) generates bound single-use authorization token.
5. Authorized execution mutates OR-3 in SQLite to RESERVED_FOR_TRAUMA with emergency clearance.
6. Post-execution verification queries SQLite and validates disk state.
7. Token binding enforces resource and action affinity (cannot cross-apply).
8. Token replay attack is blocked on second execution attempt.
9. Full 8-step cycle runner executes end-to-end for both REJECT and APPROVE paths.
10. FastAPI REST approval endpoints (/api/approval/...) function according to API contract.
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from backend.app.approval.checkpoint import (
    ApprovalDecisionType,
    CheckpointState,
    RedActionProposal,
    TrueForgeApprovalCheckpoint,
    approval_manager,
)
from backend.app.agent.trueforge_approval_cycle import (
    reset_or3_to_baseline,
    run_human_in_the_loop_cycle,
)
from backend.app.main import app
from backend.app.services.database import (
    AuditEventRecord,
    OperatingRoomRecord,
    SessionLocal,
    init_db,
)
from backend.app.tools.exceptions import (
    StaleStateError,
    UnauthorizedRedActionError,
)
from backend.app.tools.verification_tools import verify_operational_status


@pytest.fixture(autouse=True)
def setup_test_environment():
    """Ensure database is initialized, OR-3 is at baseline, and approval manager is clean."""
    init_db()
    reset_or3_to_baseline()
    approval_manager.clear()
    yield
    reset_or3_to_baseline()
    approval_manager.clear()


@pytest.fixture
def test_client():
    """FastAPI TestClient fixture."""
    return TestClient(app)


def create_sample_proposal(resource: str = "OR-3", action_id: str = "ACT-TEST-PREEMPT") -> RedActionProposal:
    """Helper to construct a valid RedActionProposal."""
    return RedActionProposal(
        action_id=action_id,
        action_type="PREEMPT_OPERATING_ROOM",
        risk_level="RED",
        safety_category="RED",
        affected_resource=resource,
        current_state={"status": "IN_USE", "scheduled_procedure": "Elective Arthroscopic Knee Debridement"},
        proposed_state={"status": "RESERVED_FOR_TRAUMA", "is_emergency_cleared": True},
        reason="MCI casualty surge requires trauma surgical capacity.",
        expected_benefit="Converts elective OR into trauma surgical suite.",
        potential_consequence="Postponement of elective arthroscopy.",
        incident_id="INC-MCI-42",
        requires_human_approval=True,
    )


# ==============================================================================
# 1. CHECKPOINT CREATION & PAUSE STATE
# ==============================================================================
def test_propose_red_action_creates_paused_checkpoint():
    """Verify proposing a RED action halts execution at a TrueForge checkpoint in 'tool.approval_required' state."""
    db = SessionLocal()
    try:
        proposal = create_sample_proposal()
        checkpoint = approval_manager.pause_for_approval(proposal=proposal, thread_id="thread-mci-42", db=db)

        assert checkpoint.checkpoint_id.startswith("CHK-")
        assert checkpoint.state == CheckpointState.PAUSED_FOR_APPROVAL
        assert checkpoint.state.value == "tool.approval_required"
        assert checkpoint.authorization_token is None
        assert checkpoint.token_consumed is False
        assert checkpoint.proposal.affected_resource == "OR-3"

        # Verify audit trail records CHECKPOINT_CREATED
        audit = (
            db.query(AuditEventRecord)
            .filter(AuditEventRecord.event_type == "CHECKPOINT_CREATED")
            .order_by(AuditEventRecord.timestamp.desc())
            .first()
        )
        assert audit is not None
        assert audit.tier == "RED"
        assert audit.action_name == "trueforge_checkpoint_pause"
        assert proposal.action_id in audit.details_json
    finally:
        db.close()


# ==============================================================================
# 2. EXECUTION WITHOUT AUTHORIZATION IS STRICTLY BLOCKED
# ==============================================================================
def test_execution_without_token_raises_unauthorized():
    """Verify executing an action without a valid token raises UnauthorizedRedActionError."""
    proposal = create_sample_proposal()
    checkpoint = approval_manager.pause_for_approval(proposal=proposal)

    # Missing token
    with pytest.raises(UnauthorizedRedActionError) as exc_info:
        approval_manager.execute_and_verify_approved_red_action(
            checkpoint_id=checkpoint.checkpoint_id,
            authorization_token="",
        )
    assert "Missing or invalid authorization token format" in str(exc_info.value)

    # Bogus token
    with pytest.raises(UnauthorizedRedActionError) as exc_info:
        approval_manager.execute_and_verify_approved_red_action(
            checkpoint_id=checkpoint.checkpoint_id,
            authorization_token="BOGUS-TOKEN-12345",
        )
    assert "Missing or invalid authorization token format" in str(exc_info.value)


# ==============================================================================
# 3. REJECTION PATH (DENY)
# ==============================================================================
def test_human_rejection_prevents_mutation_and_records_audit():
    """Verify operator rejection marks checkpoint REJECTED, preserves SQLite state, and logs audit."""
    db = SessionLocal()
    try:
        proposal = create_sample_proposal()
        checkpoint = approval_manager.pause_for_approval(proposal=proposal, db=db)

        # Human operator rejects
        rejected_cp = approval_manager.submit_decision(
            checkpoint_id=checkpoint.checkpoint_id,
            decision=ApprovalDecisionType.DENY,
            decision_by="Dr. Marcus Vance, Chief Medical Officer",
            reason="Patient in OR-3 cannot be safely moved.",
            db=db,
        )

        assert rejected_cp.state == CheckpointState.REJECTED
        assert rejected_cp.authorization_token is None
        assert rejected_cp.decision_by == "Dr. Marcus Vance, Chief Medical Officer"

        # Attempting execution on rejected checkpoint must fail
        with pytest.raises(UnauthorizedRedActionError) as exc_info:
            approval_manager.execute_and_verify_approved_red_action(
                checkpoint_id=checkpoint.checkpoint_id,
                authorization_token="AUTH-APPROVED-FAKE",
                db=db,
            )
        assert "explicitly REJECTED" in str(exc_info.value)

        # Verify OR-3 on SQLite remains untouched
        or3 = db.query(OperatingRoomRecord).filter(OperatingRoomRecord.room_number == "OR-3").first()
        assert or3.status == "IN_USE"
        assert or3.is_emergency_cleared is False
        assert "Elective" in or3.scheduled_procedure

        # Verify audit trail
        reject_audit = (
            db.query(AuditEventRecord)
            .filter(AuditEventRecord.event_type == "APPROVAL_REJECTED")
            .order_by(AuditEventRecord.timestamp.desc())
            .first()
        )
        assert reject_audit is not None
        assert reject_audit.performed_by == "Dr. Marcus Vance, Chief Medical Officer"
        assert proposal.action_id in reject_audit.details_json
    finally:
        db.close()


# ==============================================================================
# 4. APPROVAL PATH (ALLOW) & SINGLE-USE TOKEN GENERATION
# ==============================================================================
def test_human_approval_issues_bound_token():
    """Verify operator approval transitions checkpoint to APPROVED and generates bound authorization token."""
    proposal = create_sample_proposal()
    checkpoint = approval_manager.pause_for_approval(proposal=proposal)

    approved_cp = approval_manager.submit_decision(
        checkpoint_id=checkpoint.checkpoint_id,
        decision=ApprovalDecisionType.ALLOW,
        decision_by="Dr. Eleanor Vance, Trauma Medical Director",
        reason="Surgery held in pre-op; room approved for trauma conversion.",
    )

    assert approved_cp.state == CheckpointState.APPROVED
    assert approved_cp.authorization_token is not None
    assert approved_cp.authorization_token.startswith(f"AUTH-APPROVED-{checkpoint.checkpoint_id}-OR-3-")
    assert approved_cp.token_consumed is False


# ==============================================================================
# 5. EXECUTION & POST-EXECUTION VERIFICATION
# ==============================================================================
def test_execution_mutates_sqlite_and_verifies_state():
    """Verify authorized execution mutates OR-3 in SQLite to RESERVED_FOR_TRAUMA and passes verification."""
    db = SessionLocal()
    try:
        proposal = create_sample_proposal()
        checkpoint = approval_manager.pause_for_approval(proposal=proposal, db=db)
        approved_cp = approval_manager.submit_decision(
            checkpoint_id=checkpoint.checkpoint_id,
            decision=ApprovalDecisionType.APPROVE,
            decision_by="Dr. Eleanor Vance",
            db=db,
        )

        result = approval_manager.execute_and_verify_approved_red_action(
            checkpoint_id=approved_cp.checkpoint_id,
            authorization_token=approved_cp.authorization_token,
            db=db,
        )

        assert result["status"] == "SUCCESS"
        assert result["resource"] == "OR-3"
        assert result["new_state"]["status"] == "RESERVED_FOR_TRAUMA"
        assert result["new_state"]["is_emergency_cleared"] is True
        assert result["verification"]["verified"] is True

        # Check SQLite disk state directly
        or3 = db.query(OperatingRoomRecord).filter(OperatingRoomRecord.room_number == "OR-3").first()
        assert or3.status == "RESERVED_FOR_TRAUMA"
        assert or3.is_emergency_cleared is True
        assert "POSTPONED: Elective Arthroscopic Knee Debridement" in or3.scheduled_procedure

        # Verify audit trail records CONSEQUENTIAL_ACTION_EXECUTED
        exec_audit = (
            db.query(AuditEventRecord)
            .filter(AuditEventRecord.event_type == "CONSEQUENTIAL_ACTION_EXECUTED")
            .order_by(AuditEventRecord.timestamp.desc())
            .first()
        )
        assert exec_audit is not None
        assert exec_audit.tier == "RED"
        assert exec_audit.performed_by == "AIMBULENCE_EXECUTOR"
        assert proposal.action_id in exec_audit.details_json
    finally:
        db.close()


# ==============================================================================
# 6. TOKEN BINDING ENFORCEMENT (RESOURCE & ACTION MISMATCH)
# ==============================================================================
def test_token_binding_prevents_resource_cross_application():
    """Verify token issued for OR-3 cannot be used on a different resource (OR-4)."""
    proposal = create_sample_proposal(resource="OR-3")
    checkpoint = approval_manager.pause_for_approval(proposal=proposal)
    approved_cp = approval_manager.submit_decision(
        checkpoint_id=checkpoint.checkpoint_id,
        decision=ApprovalDecisionType.ALLOW,
        decision_by="Dr. Eleanor Vance",
    )

    valid_token = approved_cp.authorization_token

    # Attempting to validate token for OR-4 instead of OR-3
    with pytest.raises(UnauthorizedRedActionError) as exc_info:
        approval_manager.validate_authorization(
            checkpoint_id=approved_cp.checkpoint_id,
            action_id=proposal.action_id,
            resource_id="OR-4",
            authorization_token=valid_token,
        )
    assert "Token issued for resource 'OR-3', not 'OR-4'" in str(exc_info.value)


# ==============================================================================
# 7. REPLAY ATTACK PREVENTION (SINGLE-USE TOKEN)
# ==============================================================================
def test_token_replay_attack_prevented():
    """Verify single-use authorization token cannot be consumed twice."""
    db = SessionLocal()
    try:
        proposal = create_sample_proposal()
        checkpoint = approval_manager.pause_for_approval(proposal=proposal, db=db)
        approved_cp = approval_manager.submit_decision(
            checkpoint_id=checkpoint.checkpoint_id,
            decision=ApprovalDecisionType.ALLOW,
            decision_by="Dr. Eleanor Vance",
            db=db,
        )
        token = approved_cp.authorization_token

        # First execution succeeds
        res1 = approval_manager.execute_and_verify_approved_red_action(
            checkpoint_id=approved_cp.checkpoint_id,
            authorization_token=token,
            db=db,
        )
        assert res1["status"] == "SUCCESS"

        # Replay attempt with same token must be rejected
        with pytest.raises(UnauthorizedRedActionError) as exc_info:
            approval_manager.execute_and_verify_approved_red_action(
                checkpoint_id=approved_cp.checkpoint_id,
                authorization_token=token,
                db=db,
            )
        assert "Authorization token has already been consumed. Replay attack prevented." in str(exc_info.value)
    finally:
        db.close()


# ==============================================================================
# 8. COMPLETE 8-STEP CYCLE RUNNER (REJECT & APPROVE)
# ==============================================================================
def test_complete_human_in_the_loop_cycle_runner():
    """Verify the 8-step cycle runner executes all steps for both rejection and approval."""
    # Run rejection cycle
    reject_run = run_human_in_the_loop_cycle(
        incoming_casualties=42,
        human_decision=ApprovalDecisionType.DENY,
        operator_name="Dr. Marcus Vance",
        operator_reason="Safety hold",
    )
    assert reject_run["cycle_status"] == "COMPLETED"
    assert reject_run["path"] == "REJECT"
    assert reject_run["final_checkpoint_state"] == "REJECTED"
    assert len(reject_run["steps"]) == 8

    # Ensure OR-3 remained unmutated
    db = SessionLocal()
    or3_after_reject = db.query(OperatingRoomRecord).filter(OperatingRoomRecord.room_number == "OR-3").first()
    assert or3_after_reject.status == "IN_USE"
    db.close()

    # Run approval cycle
    approve_run = run_human_in_the_loop_cycle(
        incoming_casualties=42,
        human_decision=ApprovalDecisionType.ALLOW,
        operator_name="Dr. Eleanor Vance",
        operator_reason="Cleared for trauma",
    )
    assert approve_run["cycle_status"] == "COMPLETED"
    assert approve_run["path"] == "APPROVE"
    assert approve_run["final_checkpoint_state"] == "EXECUTED"
    assert len(approve_run["steps"]) == 8
    assert approve_run["execution_result"]["status"] == "SUCCESS"
    assert approve_run["verification_result"]["verified"] is True


# ==============================================================================
# 9. FASTAPI REST ENDPOINTS (/api/approval/...)
# ==============================================================================
def test_approval_api_endpoints(test_client):
    """Verify the FastAPI approval endpoints for proposing, querying, deciding, and executing."""
    # 1. Propose RED action via REST
    payload = {
        "action_id": "ACT-REST-OR3",
        "action_type": "PREEMPT_OPERATING_ROOM",
        "risk_level": "RED",
        "safety_category": "RED",
        "affected_resource": "OR-3",
        "current_state": {"status": "IN_USE"},
        "proposed_state": {"status": "RESERVED_FOR_TRAUMA"},
        "reason": "REST API MCI Preemption",
        "expected_benefit": "Trauma surgery capacity",
        "potential_consequence": "Elective postponement",
        "incident_id": "INC-REST-01",
        "requires_human_approval": True,
    }
    create_res = test_client.post("/api/approval/propose", json=payload)
    assert create_res.status_code == 201
    cp_data = create_res.json()
    checkpoint_id = cp_data["checkpoint_id"]
    assert cp_data["state"] == "tool.approval_required"

    # 2. Query checkpoint by ID
    get_res = test_client.get(f"/api/approval/checkpoints/{checkpoint_id}")
    assert get_res.status_code == 200
    assert get_res.json()["checkpoint_id"] == checkpoint_id

    # 3. List checkpoints
    list_res = test_client.get("/api/approval/checkpoints")
    assert list_res.status_code == 200
    assert any(c["checkpoint_id"] == checkpoint_id for c in list_res.json())

    # 4. Decide checkpoint via REST (Approve and Execute)
    decide_payload = {
        "checkpoint_id": checkpoint_id,
        "decision": "allow",
        "decision_by": "Dr. REST Operator",
        "reason": "REST authorized",
        "execute_if_approved": True,
    }
    decide_res = test_client.post("/api/approval/decide", json=decide_payload)
    assert decide_res.status_code == 200
    res_json = decide_res.json()
    assert res_json["status"] == "DECIDED"
    assert res_json["checkpoint"]["state"] == "EXECUTED"
    assert res_json["execution"]["status"] == "SUCCESS"
    assert res_json["execution"]["verification"]["verified"] is True
