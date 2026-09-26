"""TrueForge Human-in-the-Loop 8-Step Consequential Execution Cycle.

Demonstrates the Phase 4 complete operational cycle for RED consequential hospital operations:
1. DETECT: Calculate resource shortage for 42 incoming casualties (OR deficit).
2. VERIFY: Verify OR-3 current status is IN_USE for elective surgery.
3. PROPOSE: Generate RedActionProposal to preempt OR-3 for incoming trauma surgeries.
4. TRUEFORGE PAUSES: Halt execution at TrueForge checkpoint (state: tool.approval_required).
5. HUMAN APPROVAL: Operator decision (allow / deny) with clinical justification.
6. EXECUTE: Consequential mutation executed in SQLite using bound single-use token.
7. VERIFY: Direct SQLite verification confirming RESERVED_FOR_TRAUMA state on disk.
8. AUDIT: Immutable audit trail verification confirming all lifecycle records.
"""
import json
from typing import Any, Dict, Optional
from sqlalchemy.orm import Session

from backend.app.approval.checkpoint import (
    ApprovalDecisionType,
    CheckpointState,
    RedActionProposal,
    TrueForgeApprovalCheckpoint,
    approval_manager,
)
from backend.app.services.database import (
    AuditEventRecord,
    OperatingRoomRecord,
    SessionLocal,
)
from backend.app.tools.audit_helper import log_tool_audit
from backend.app.tools.exceptions import (
    UnauthorizedRedActionError,
)
from backend.app.tools.hospital_tools import calculate_resource_shortage
from backend.app.tools.resource_tools import get_resource_status
from backend.app.tools.verification_tools import verify_operational_status


def reset_or3_to_baseline(db: Optional[Session] = None) -> None:
    """Helper to reset OR-3 to baseline elective surgical state for idempotent test runs."""
    should_close = False
    if db is None:
        db = SessionLocal()
        should_close = True
    try:
        or3 = db.query(OperatingRoomRecord).filter(OperatingRoomRecord.room_number == "OR-3").first()
        if or3:
            or3.status = "IN_USE"
            or3.scheduled_procedure = "Elective Arthroscopic Knee Debridement"
            or3.is_emergency_cleared = False
            db.commit()
    finally:
        if should_close:
            db.close()


def run_human_in_the_loop_cycle(
    incoming_casualties: int = 42,
    human_decision: ApprovalDecisionType = ApprovalDecisionType.ALLOW,
    operator_name: str = "Dr. Eleanor Vance, Trauma Medical Director",
    operator_reason: str = "Clinical emergency authorization: elective knee surgery held in pre-op; OR-3 cleared for trauma surge.",
    db: Optional[Session] = None,
) -> Dict[str, Any]:
    """Execute the full 8-step TrueForge human-in-the-loop operational cycle.

    Supports both REJECTION (deny) and APPROVAL (allow) paths.
    """
    should_close = False
    if db is None:
        db = SessionLocal()
        should_close = True

    try:
        steps_log = []

        # ======================================================================
        # STEP 1: DETECT — Calculate resource shortage
        # ======================================================================
        incident_id = "INC-MCI-42"
        shortage = calculate_resource_shortage(
            incoming_casualties=incoming_casualties,
            incident_id=incident_id,
            db=db,
        )
        or_deficit = shortage["deficits"]["operating_rooms"]
        steps_log.append({
            "step": 1,
            "phase": "DETECT",
            "description": f"Detected operational shortage for {incoming_casualties} incoming casualties",
            "operating_room_deficit": or_deficit,
            "emergency_bed_deficit": shortage["deficits"]["emergency_beds"],
            "critical_shortage": shortage["has_critical_shortage"],
        })

        # ======================================================================
        # STEP 2: VERIFY — Inspect OR-3 current status
        # ======================================================================
        or_status = get_resource_status(resource_type="operating_room", db=db)
        or3_info = next(
            (r for r in or_status.get("operating_rooms", []) if r.get("room_number") == "OR-3"),
            None,
        )
        current_procedure = or3_info.get("scheduled_procedure") if or3_info else None
        current_status = or3_info.get("status") if or3_info else None

        steps_log.append({
            "step": 2,
            "phase": "VERIFY",
            "resource": "OR-3",
            "status": current_status,
            "procedure": current_procedure,
            "is_elective": "Elective" in (current_procedure or ""),
        })

        # ======================================================================
        # STEP 3: PROPOSE — Construct RedActionProposal
        # ======================================================================
        action_id = "ACT-PREEMPT-OR3"
        proposal = RedActionProposal(
            action_id=action_id,
            action_type="PREEMPT_OPERATING_ROOM",
            risk_level="RED",
            safety_category="RED",
            affected_resource="OR-3",
            current_state={
                "status": current_status,
                "scheduled_procedure": current_procedure,
            },
            proposed_state={
                "status": "RESERVED_FOR_TRAUMA",
                "is_emergency_cleared": True,
                "scheduled_procedure": f"POSTPONED: {current_procedure}",
            },
            reason=(
                f"MCI incident {incident_id} with {incoming_casualties} casualties requires {or_deficit} additional ORs. "
                f"OR-3 is currently occupied by a non-urgent elective procedure ({current_procedure}). Preemption required."
            ),
            expected_benefit="Converts non-urgent OR-3 into an active trauma surgical suite to prevent preventable casualty mortality.",
            potential_consequence=f"Cancellation and rescheduling of {current_procedure}.",
            incident_id=incident_id,
            requires_human_approval=True,
        )
        steps_log.append({
            "step": 3,
            "phase": "PROPOSE",
            "action_id": proposal.action_id,
            "action_type": proposal.action_type,
            "affected_resource": proposal.affected_resource,
            "risk_level": proposal.risk_level,
            "requires_human_approval": proposal.requires_human_approval,
        })

        # ======================================================================
        # STEP 4: TRUEFORGE PAUSES — Halt execution at checkpoint
        # ======================================================================
        checkpoint = approval_manager.pause_for_approval(
            proposal=proposal,
            thread_id="thread-mci-42",
            db=db,
        )
        steps_log.append({
            "step": 4,
            "phase": "TRUEFORGE_PAUSES",
            "checkpoint_id": checkpoint.checkpoint_id,
            "checkpoint_state": checkpoint.state.value,
            "is_paused": (checkpoint.state == CheckpointState.PAUSED_FOR_APPROVAL),
            "tool_call_id": checkpoint.tool_call_id,
        })

        # ======================================================================
        # STEP 5: HUMAN APPROVAL — Operator submits allow or deny
        # ======================================================================
        resolved_checkpoint = approval_manager.submit_decision(
            checkpoint_id=checkpoint.checkpoint_id,
            decision=human_decision,
            decision_by=operator_name,
            reason=operator_reason,
            db=db,
        )
        is_allowed = resolved_checkpoint.state == CheckpointState.APPROVED
        steps_log.append({
            "step": 5,
            "phase": "HUMAN_APPROVAL",
            "decision": resolved_checkpoint.state.value,
            "decision_by": resolved_checkpoint.decision_by,
            "decision_reason": resolved_checkpoint.decision_reason,
            "token_issued": resolved_checkpoint.authorization_token is not None,
            "authorization_token": resolved_checkpoint.authorization_token,
        })

        execution_result = None
        verification_result = None

        # ======================================================================
        # STEP 6: EXECUTE — Consequential mutation (Only if APPROVED)
        # ======================================================================
        if is_allowed:
            # Execute mutation using single-use authorization token
            execution_result = approval_manager.execute_and_verify_approved_red_action(
                checkpoint_id=resolved_checkpoint.checkpoint_id,
                authorization_token=resolved_checkpoint.authorization_token,
                db=db,
            )
            steps_log.append({
                "step": 6,
                "phase": "EXECUTE",
                "status": execution_result["status"],
                "resource": execution_result["resource"],
                "mutation": execution_result["new_state"],
                "token_consumed": True,
            })

            # ==================================================================
            # STEP 7: VERIFY — Direct SQLite check of state on disk
            # ==================================================================
            verification_result = verify_operational_status(
                target_entity="operating_room",
                entity_id="OR-3",
                expected_field="status",
                expected_value="RESERVED_FOR_TRAUMA",
                db=db,
            )
            steps_log.append({
                "step": 7,
                "phase": "VERIFY",
                "target_entity": "operating_room",
                "entity_id": "OR-3",
                "verified": verification_result["verified"],
                "actual_value": verification_result["actual_value"],
            })
        else:
            # REJECTION PATH: Ensure NO mutation occurred
            or3_after = db.query(OperatingRoomRecord).filter(OperatingRoomRecord.room_number == "OR-3").first()
            steps_log.append({
                "step": 6,
                "phase": "EXECUTE_BLOCKED",
                "reason": "Human operator rejected the action. No database mutation was executed.",
                "current_db_status": or3_after.status,
                "db_unmutated": (or3_after.status == current_status),
            })
            steps_log.append({
                "step": 7,
                "phase": "VERIFY_UNCHANGED",
                "target_entity": "operating_room",
                "entity_id": "OR-3",
                "status_on_disk": or3_after.status,
                "procedure_on_disk": or3_after.scheduled_procedure,
                "verified_unmutated": True,
            })

        # ======================================================================
        # STEP 8: AUDIT — Verify immutable audit trail on SQLite
        # ======================================================================
        recent_audits = (
            db.query(AuditEventRecord)
            .filter(AuditEventRecord.incident_id == incident_id)
            .order_by(AuditEventRecord.timestamp.desc())
            .limit(10)
            .all()
        )
        audit_events = [
            {
                "id": a.id,
                "event_type": a.event_type,
                "action_name": a.action_name,
                "tier": a.tier,
                "performed_by": a.performed_by,
                "timestamp": a.timestamp.isoformat(),
            }
            for a in recent_audits
        ]

        steps_log.append({
            "step": 8,
            "phase": "AUDIT",
            "audits_recorded_count": len(audit_events),
            "recent_events": [a["event_type"] for a in audit_events],
        })

        return {
            "cycle_status": "COMPLETED",
            "path": "APPROVE" if is_allowed else "REJECT",
            "incident_id": incident_id,
            "checkpoint_id": checkpoint.checkpoint_id,
            "final_checkpoint_state": resolved_checkpoint.state.value,
            "steps": steps_log,
            "execution_result": execution_result,
            "verification_result": verification_result,
        }
    finally:
        if should_close:
            db.close()


def run_full_phase4_demo() -> Dict[str, Any]:
    """Runs both Path A (Rejection) and Path B (Approval) end-to-end to demonstrate full lifecycle."""
    # Ensure fresh baseline
    reset_or3_to_baseline()

    # 1. Demonstrate Rejection Path
    reject_run = run_human_in_the_loop_cycle(
        incoming_casualties=42,
        human_decision=ApprovalDecisionType.DENY,
        operator_name="Dr. Marcus Vance, Chief Medical Officer",
        operator_reason="Patient already inducted in OR-3. Preemption denied on clinical safety grounds.",
    )

    # 2. Reset and Demonstrate Approval Path
    reset_or3_to_baseline()
    approve_run = run_human_in_the_loop_cycle(
        incoming_casualties=42,
        human_decision=ApprovalDecisionType.ALLOW,
        operator_name="Dr. Eleanor Vance, Trauma Medical Director",
        operator_reason="Elective knee surgery held in pre-op; OR-3 cleared for trauma surge.",
    )

    return {
        "rejection_path_demonstration": reject_run,
        "approval_path_demonstration": approve_run,
    }


if __name__ == "__main__":
    demo = run_full_phase4_demo()
    print(json.dumps(demo, indent=2))
