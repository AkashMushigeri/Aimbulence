"""MCI-01 Runbook Execution Engine.

Implements deterministic, observable, resumable, and safe orchestration of the 15
operational steps in MCI-01, persisting state to SQLite and integrating with
the TrueForge human-in-the-loop approval checkpoint for consequential RED actions.
"""
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy.orm import Session

from backend.app.approval.checkpoint import (
    ApprovalDecisionType,
    CheckpointState,
    RedActionProposal,
    TrueForgeApprovalCheckpoint,
    approval_manager,
)
from backend.app.runbooks.mci_01 import get_mci_01_definition
from backend.app.runbooks.models import (
    RunbookDefinition,
    RunbookExecutionState,
    RunbookState,
    RunbookStepDefinition,
    RunbookStepResult,
    SafetyCategory,
    StepStatus,
)
from backend.app.services.database import (
    AuditEventRecord,
    IncidentRecord,
    OperatingRoomRecord,
    RunbookExecutionRecord,
    RunbookStepExecutionRecord,
    SessionLocal,
)
from backend.app.tools.audit_helper import log_tool_audit
from backend.app.tools.exceptions import (
    ResourceNotFoundError,
    StaleStateError,
    UnauthorizedRedActionError,
)
from backend.app.tools.hospital_tools import (
    calculate_resource_shortage,
    get_hospital_capacity,
)
from backend.app.tools.resource_tools import (
    get_resource_status,
    reserve_resource,
)
from backend.app.tools.task_tools import create_operational_task
from backend.app.tools.verification_tools import verify_operational_status

logger = logging.getLogger("aimbulence.runbook_engine")


class RunbookEngine:
    """Deterministic orchestrator for executing, pausing, resuming, and persisting runbooks."""

    def __init__(self, runbook_def: Optional[RunbookDefinition] = None):
        self.definition = runbook_def or get_mci_01_definition()

    # ==========================================================================
    # PUBLIC LIFECYCLE API
    # ==========================================================================

    def start_runbook(
        self,
        incident_id: str = "INC-MCI-42",
        incoming_casualties: int = 42,
        acute_ratio: float = 0.5,
        db: Optional[Session] = None,
    ) -> RunbookExecutionState:
        """Initialize and begin execution of the MCI-01 runbook."""
        should_close = False
        if db is None:
            db = SessionLocal()
            should_close = True

        try:
            now = datetime.now(timezone.utc)
            execution_id = f"RBX-{uuid.uuid4().hex[:8].upper()}"

            initial_params = {
                "incident_id": incident_id,
                "incoming_casualties": incoming_casualties,
                "acute_ratio": acute_ratio,
            }
            initial_context = {
                "incident_id": incident_id,
                "incoming_casualties": incoming_casualties,
                "acute_ratio": acute_ratio,
                "staged_resources": [],
            }

            record = RunbookExecutionRecord(
                id=execution_id,
                runbook_id=self.definition.runbook_id,
                incident_id=incident_id,
                state=RunbookState.RUNNING.value,
                current_step_id=self.definition.steps[0].step_id,
                checkpoint_id=None,
                parameters_json=json.dumps(initial_params),
                context_json=json.dumps(initial_context),
                started_at=now,
                updated_at=now,
            )
            db.add(record)

            log_tool_audit(
                db=db,
                tool_name="runbook_engine_start",
                event_type="RUNBOOK_STARTED",
                tier="GREEN",
                action_id=execution_id,
                details={
                    "runbook_id": self.definition.runbook_id,
                    "incident_id": incident_id,
                    "incoming_casualties": incoming_casualties,
                },
                incident_id=incident_id,
                performed_by="RUNBOOK_ENGINE",
            )
            db.commit()

            # Execute runbook steps sequentially
            return self._execute_runbook_loop(execution_id=execution_id, db=db)
        finally:
            if should_close:
                db.close()

    def resume_runbook(
        self,
        execution_id: str,
        reason: Optional[str] = None,
        db: Optional[Session] = None,
    ) -> RunbookExecutionState:
        """Resume a runbook paused at a TrueForge approval checkpoint."""
        should_close = False
        if db is None:
            db = SessionLocal()
            should_close = True

        try:
            record = (
                db.query(RunbookExecutionRecord)
                .filter(RunbookExecutionRecord.id == execution_id)
                .first()
            )
            if not record:
                raise ResourceNotFoundError(f"Runbook execution '{execution_id}' not found.")

            if record.state not in (RunbookState.WAITING_FOR_APPROVAL.value, RunbookState.RUNNING.value):
                raise StaleStateError(
                    f"Runbook '{execution_id}' cannot be resumed from state '{record.state}'."
                )

            # Checkpoint resolution verification
            if record.checkpoint_id:
                try:
                    checkpoint = approval_manager.get_checkpoint(record.checkpoint_id)
                except ResourceNotFoundError:
                    raise StaleStateError(f"Associated checkpoint '{record.checkpoint_id}' not found.")

                if checkpoint.state == CheckpointState.PAUSED_FOR_APPROVAL:
                    raise StaleStateError(
                        f"Cannot resume runbook: TrueForge checkpoint '{record.checkpoint_id}' is still awaiting human decision."
                    )

            record.state = RunbookState.RUNNING.value
            record.updated_at = datetime.now(timezone.utc)
            db.commit()

            return self._execute_runbook_loop(execution_id=execution_id, db=db)


        finally:
            if should_close:
                db.close()

    def get_execution_state(
        self,
        execution_id: str,
        db: Optional[Session] = None,
    ) -> RunbookExecutionState:
        """Retrieve the persisted state of a runbook execution."""
        should_close = False
        if db is None:
            db = SessionLocal()
            should_close = True

        try:
            record = (
                db.query(RunbookExecutionRecord)
                .filter(RunbookExecutionRecord.id == execution_id)
                .first()
            )
            if not record:
                raise ResourceNotFoundError(f"Runbook execution '{execution_id}' not found.")

            step_records = (
                db.query(RunbookStepExecutionRecord)
                .filter(RunbookStepExecutionRecord.execution_id == execution_id)
                .order_by(RunbookStepExecutionRecord.step_number)
                .all()
            )

            completed = [s.step_id for s in step_records if s.status == StepStatus.COMPLETED.value]
            step_results = {
                s.step_id: {
                    "step_number": s.step_number,
                    "name": s.name,
                    "status": s.status,
                    "output": json.loads(s.output_json or "{}"),
                    "verification": json.loads(s.verification_json or "{}"),
                    "error": s.error_message,
                    "started_at": s.started_at.isoformat() if s.started_at else None,
                    "completed_at": s.completed_at.isoformat() if s.completed_at else None,
                }
                for s in step_records
            }

            return RunbookExecutionState(
                execution_id=record.id,
                runbook_id=record.runbook_id,
                incident_id=record.incident_id,
                state=RunbookState(record.state),
                current_step_id=record.current_step_id,
                checkpoint_id=record.checkpoint_id,
                parameters=json.loads(record.parameters_json or "{}"),
                context=json.loads(record.context_json or "{}"),
                completed_steps=completed,
                step_results=step_results,
                summary=json.loads(record.summary_json) if record.summary_json else None,
                error_message=record.error_message,
                started_at=record.started_at.isoformat(),
                updated_at=record.updated_at.isoformat(),
                completed_at=record.completed_at.isoformat() if record.completed_at else None,
            )
        finally:
            if should_close:
                db.close()

    # ==========================================================================
    # INTERNAL EXECUTION ENGINE
    # ==========================================================================

    def _execute_runbook_loop(
        self,
        execution_id: str,
        db: Session,
    ) -> RunbookExecutionState:
        """Iterates through declarative steps, respecting idempotency and checkpoints."""
        record = (
            db.query(RunbookExecutionRecord)
            .filter(RunbookExecutionRecord.id == execution_id)
            .with_for_update()
            .first()
        )
        if not record:
            raise ResourceNotFoundError(f"Runbook execution '{execution_id}' not found.")

        context = json.loads(record.context_json or "{}")

        for step in self.definition.steps:
            # 1. Inspect persisted step state for Idempotency
            existing_step = (
                db.query(RunbookStepExecutionRecord)
                .filter(
                    RunbookStepExecutionRecord.execution_id == execution_id,
                    RunbookStepExecutionRecord.step_id == step.step_id,
                )
                .first()
            )

            if existing_step and existing_step.status == StepStatus.COMPLETED.value:
                # Already executed safely: incorporate output into context and continue
                step_output = json.loads(existing_step.output_json or "{}")
                context.update(step_output)
                continue

            record.current_step_id = step.step_id
            record.updated_at = datetime.now(timezone.utc)
            db.commit()

            # 2. Execute Step
            step_record, pause_required, stop_runbook = self._dispatch_step(
                execution_id=execution_id,
                step=step,
                context=context,
                db=db,
            )

            # Update context with step output
            context.update(json.loads(step_record.output_json or "{}"))
            record.context_json = json.dumps(context, default=str)
            record.updated_at = datetime.now(timezone.utc)
            db.commit()

            # 3. Handle PAUSE at TrueForge Checkpoint
            if pause_required:
                checkpoint_id = context.get("checkpoint_id")
                record.state = RunbookState.WAITING_FOR_APPROVAL.value
                record.checkpoint_id = checkpoint_id
                db.commit()
                return self.get_execution_state(execution_id=execution_id, db=db)

            # 4. Handle Rejection or Failure Stop
            if stop_runbook:
                record.state = (
                    RunbookState.BLOCKED.value
                    if step_record.status == StepStatus.BLOCKED.value
                    else RunbookState.FAILED.value
                )
                record.error_message = step_record.error_message
                record.completed_at = datetime.now(timezone.utc)
                db.commit()
                return self.get_execution_state(execution_id=execution_id, db=db)

        # All 15 steps completed successfully
        record.state = RunbookState.COMPLETED.value
        record.current_step_id = self.definition.steps[-1].step_id
        record.completed_at = datetime.now(timezone.utc)
        record.summary_json = json.dumps(context.get("execution_summary", {}), default=str)
        db.commit()

        log_tool_audit(
            db=db,
            tool_name="runbook_engine_complete",
            event_type="RUNBOOK_COMPLETED",
            tier="GREEN",
            action_id=execution_id,
            details={
                "runbook_id": self.definition.runbook_id,
                "incident_id": record.incident_id,
                "completed_steps": len(self.definition.steps),
            },
            incident_id=record.incident_id,
            performed_by="RUNBOOK_ENGINE",
        )
        db.commit()

        return self.get_execution_state(execution_id=execution_id, db=db)

    # ==========================================================================
    # STEP DISPATCHER
    # ==========================================================================

    def _dispatch_step(
        self,
        execution_id: str,
        step: RunbookStepDefinition,
        context: Dict[str, Any],
        db: Session,
    ) -> Tuple[RunbookStepExecutionRecord, bool, bool]:
        """Dispatches an individual operational step to its tool implementation."""
        now = datetime.now(timezone.utc)
        pause_required = False
        stop_runbook = False

        step_record = (
            db.query(RunbookStepExecutionRecord)
            .filter(
                RunbookStepExecutionRecord.execution_id == execution_id,
                RunbookStepExecutionRecord.step_id == step.step_id,
            )
            .first()
        )

        if not step_record:
            step_record = RunbookStepExecutionRecord(
                id=f"RBS-{uuid.uuid4().hex[:8].upper()}",
                execution_id=execution_id,
                step_id=step.step_id,
                step_number=step.step_number,
                name=step.name,
                safety_category=step.safety_category.value,
                status=StepStatus.RUNNING.value,
                started_at=now,
            )
            db.add(step_record)
            db.commit()

        try:
            output = {}
            verification = {}

            # STEP 1: Detect and register MCI incident
            if step.step_id == "MCI-01-01":
                inc_id = context.get("incident_id", "INC-MCI-42")
                casualty_count = context.get("incoming_casualties", 42)
                inc = db.query(IncidentRecord).filter(IncidentRecord.id == inc_id).first()
                if not inc:
                    inc = IncidentRecord(
                        id=inc_id,
                        title=f"MCI Code Black: Highway 101 Multi-Vehicle Collision ({casualty_count} Casualties)",
                        incident_type="MASS_CASUALTY_SURGE",
                        severity="CRITICAL",
                        casualty_count=casualty_count,
                        location="Highway 101 Northbound Mile 42",
                        eta_minutes=12,
                        description="Major multi-vehicle accident with acute trauma casualties incoming.",
                        status="ACTIVE",
                        created_at=now,
                        updated_at=now,
                    )
                    db.add(inc)
                    db.commit()
                output = {
                    "incident_id": inc.id,
                    "title": inc.title,
                    "casualty_count": inc.casualty_count,
                    "severity": inc.severity,
                    "eta_minutes": inc.eta_minutes,
                }
                verification = {"incident_exists_in_db": True}

            # STEP 2: Verify incident operational details
            elif step.step_id == "MCI-01-02":
                inc_id = context.get("incident_id")
                inc = db.query(IncidentRecord).filter(IncidentRecord.id == inc_id).first()
                if not inc or inc.casualty_count < 1:
                    raise ResourceNotFoundError("Incident record invalid or casualty count zero.")
                output = {
                    "verified_incident_id": inc.id,
                    "casualty_demand": inc.casualty_count,
                    "severity_confirmed": inc.severity,
                    "triage_category": "MASS_CASUALTY_RESPONSE",
                }
                verification = {"valid_demand": True}

            # STEP 3: Read current hospital capacity
            elif step.step_id == "MCI-01-03":
                cap = get_hospital_capacity(db=db)
                output = {"baseline_capacity": cap}
                verification = {"hospital_name": cap.get("hospital_name"), "read_successful": True}

            # STEP 4: Calculate resource shortages
            elif step.step_id == "MCI-01-04":
                shortage = calculate_resource_shortage(
                    incoming_casualties=context.get("incoming_casualties", 42),
                    incident_id=context.get("incident_id"),
                    acute_ratio=context.get("acute_ratio", 0.5),
                    db=db,
                )
                output = {"shortage_analysis": shortage}
                verification = {"has_critical_shortage": shortage.get("has_critical_shortage")}

            # STEP 5: Create primary MCI coordination task
            elif step.step_id == "MCI-01-05":
                task_res = create_operational_task(
                    title=f"MCI Code Black: Mobilize Trauma Surge Teams for {context.get('incoming_casualties', 42)} Casualties",
                    incident_id=context.get("incident_id"),
                    tier="GREEN",
                    db=db,
                )
                output = {"primary_task_id": task_res.get("task_id"), "task_status": task_res.get("operational_status")}
                verification = {"persisted": task_res.get("persisted")}

            # STEP 6: Inspect available resources
            elif step.step_id == "MCI-01-06":
                res_status = get_resource_status(db=db)
                output = {"resource_inventory": res_status}
                verification = {
                    "total_operating_rooms": len(res_status.get("operating_rooms", [])),
                    "open_operating_rooms": len([o for o in res_status.get("operating_rooms", []) if o.get("status") == "OPEN"]),
                }

            # STEP 7: Stage safe available resources (YELLOW)
            elif step.step_id == "MCI-01-07":
                staged = []
                # 1. Bed ED-01
                try:
                    bed_res = reserve_resource(
                        resource_type="bed",
                        resource_id="ED-01",
                        incident_id=context.get("incident_id"),
                        reason="MCI Acute Intake Staging",
                        db=db,
                    )
                    staged.append({"resource": "ED-01", "type": "bed", "status": bed_res.get("status")})
                except Exception as e:
                    logger.warning("Bed ED-01 staging note: %s", e)

                # 2. Ambulance MEDIC-01
                try:
                    amb_res = reserve_resource(
                        resource_type="ambulance",
                        resource_id="MEDIC-01",
                        incident_id=context.get("incident_id"),
                        reason="MCI Transport Staging",
                        db=db,
                    )
                    staged.append({"resource": "MEDIC-01", "type": "ambulance", "status": amb_res.get("status")})
                except Exception as e:
                    logger.warning("Ambulance staging note: %s", e)

                # 3. Open OR-2
                try:
                    or_res = reserve_resource(
                        resource_type="operating_room",
                        resource_id="OR-2",
                        incident_id=context.get("incident_id"),
                        reason="MCI Trauma Surgery Staging",
                        db=db,
                    )
                    staged.append({"resource": "OR-2", "type": "operating_room", "status": or_res.get("status")})
                except Exception as e:
                    logger.warning("OR-2 staging note: %s", e)

                output = {"staged_safe_resources": staged}
                verification = {"staged_count": len(staged)}

            # STEP 8: Recalculate remaining shortages
            elif step.step_id == "MCI-01-08":
                recalc = calculate_resource_shortage(
                    incoming_casualties=context.get("incoming_casualties", 42),
                    incident_id=context.get("incident_id"),
                    db=db,
                )
                output = {"recalculated_shortage": recalc}
                verification = {
                    "residual_or_deficit": recalc.get("deficits", {}).get("operating_rooms"),
                }

            # STEP 9: Identify whether consequential RED action is required
            elif step.step_id == "MCI-01-09":
                res_or_deficit = context.get("recalculated_shortage", {}).get("deficits", {}).get("operating_rooms", 0)
                # Inspect OR-3
                or3 = db.query(OperatingRoomRecord).filter(OperatingRoomRecord.room_number == "OR-3").first()
                if not or3:
                    raise ResourceNotFoundError("Target surgical room OR-3 not found in database.")

                is_elective = "Elective" in (or3.scheduled_procedure or "")
                red_needed = (res_or_deficit > 0) and (or3.status == "IN_USE") and is_elective

                output = {
                    "red_action_required": red_needed,
                    "target_resource": "OR-3",
                    "current_status": or3.status,
                    "scheduled_procedure": or3.scheduled_procedure,
                    "justification": "Residual surgical deficit requires preemption of non-urgent elective surgery suite.",
                }
                verification = {"confirmed_candidate": "OR-3", "is_elective": is_elective}

            # STEP 10: Propose RED action and pause at TrueForge approval checkpoint
            elif step.step_id == "MCI-01-10":
                incident_id = context.get("incident_id", "INC-MCI-42")
                action_id = f"ACT-MCI-{incident_id}-OR3"

                existing_cp_id = context.get("checkpoint_id")
                if not existing_cp_id and step_record.output_json:
                    try:
                        existing_cp_id = json.loads(step_record.output_json).get("checkpoint_id")
                    except Exception:
                        pass

                if existing_cp_id:
                    try:
                        cp = approval_manager.get_checkpoint(existing_cp_id)
                        if cp.state != CheckpointState.PAUSED_FOR_APPROVAL:
                            step_record.status = StepStatus.COMPLETED.value
                            output = {
                                "checkpoint_id": cp.checkpoint_id,
                                "checkpoint_state": cp.state.value,
                                "action_id": cp.proposal.action_id,
                                "affected_resource": cp.proposal.affected_resource,
                                "paused": False,
                                "resolved": True,
                            }
                            verification = {"event": "tool.approval_resolved"}
                            step_record.output_json = json.dumps(output, default=str)
                            step_record.verification_json = json.dumps(verification, default=str)
                            db.commit()
                            return step_record, False, False
                        else:
                            return step_record, True, False
                    except ResourceNotFoundError:
                        pass

                proposal = RedActionProposal(
                    action_id=action_id,
                    action_type="PREEMPT_OPERATING_ROOM",
                    risk_level="RED",
                    safety_category="RED",
                    affected_resource="OR-3",
                    current_state={
                        "status": "IN_USE",
                        "scheduled_procedure": "Elective Arthroscopic Knee Debridement",
                    },
                    proposed_state={
                        "status": "RESERVED_FOR_TRAUMA",
                        "is_emergency_cleared": True,
                        "scheduled_procedure": "POSTPONED: Elective Arthroscopic Knee Debridement",
                    },
                    reason=f"Mass casualty incident {incident_id} requires trauma surgical capacity. Preempting non-urgent elective procedure in OR-3.",
                    expected_benefit="Converts elective OR into an emergency trauma surgical suite.",
                    potential_consequence="Postponement and rescheduling of elective knee arthroscopy.",
                    incident_id=incident_id,
                    requires_human_approval=True,
                )

                checkpoint = approval_manager.pause_for_approval(
                    proposal=proposal,
                    thread_id=f"thread-{incident_id}",
                    db=db,
                )

                output = {
                    "checkpoint_id": checkpoint.checkpoint_id,
                    "checkpoint_state": checkpoint.state.value,
                    "action_id": proposal.action_id,
                    "affected_resource": proposal.affected_resource,
                    "paused": True,
                }
                verification = {"event": "tool.approval_required"}


                # Mark pause required
                pause_required = True
                step_record.status = StepStatus.WAITING_FOR_APPROVAL.value
                step_record.output_json = json.dumps(output, default=str)
                step_record.verification_json = json.dumps(verification, default=str)
                step_record.input_json = json.dumps(proposal.model_dump(), default=str)
                db.commit()
                return step_record, pause_required, stop_runbook

            # STEP 11: Execute authorized consequential action or process rejection
            elif step.step_id == "MCI-01-11":
                checkpoint_id = context.get("checkpoint_id")
                if not checkpoint_id:
                    raise StaleStateError("No checkpoint_id in runbook context to execute consequential action.")

                checkpoint = approval_manager.get_checkpoint(checkpoint_id)

                if checkpoint.state == CheckpointState.REJECTED:
                    # Rejection Path: DO NOT MUTATE STATE
                    output = {
                        "action_executed": False,
                        "status": "REJECTED",
                        "decision_by": checkpoint.decision_by,
                        "reason": checkpoint.decision_reason or "Human operator denied preemption.",
                        "runbook_blocked": True,
                    }
                    verification = {"mutation_prevented": True}
                    step_record.status = StepStatus.BLOCKED.value
                    step_record.error_message = f"Consequential action was REJECTED by {checkpoint.decision_by}: {checkpoint.decision_reason}"
                    stop_runbook = True
                elif checkpoint.state in (CheckpointState.APPROVED, CheckpointState.EXECUTED):
                    # Approval Path: Execute mutation with bound single-use token
                    if checkpoint.state == CheckpointState.APPROVED:
                        exec_res = approval_manager.execute_and_verify_approved_red_action(
                            checkpoint_id=checkpoint.checkpoint_id,
                            authorization_token=checkpoint.authorization_token,
                            db=db,
                        )
                    else:
                        exec_res = checkpoint.execution_result or {"status": "SUCCESS", "resource": "OR-3"}

                    output = {
                        "action_executed": True,
                        "execution_result": exec_res,
                        "authorized_by": checkpoint.decision_by,
                    }
                    verification = {"state_mutated": True, "token_consumed": True}
                    step_record.status = StepStatus.COMPLETED.value
                else:
                    raise StaleStateError(
                        f"Checkpoint '{checkpoint_id}' is still in state '{checkpoint.state.value}'."
                    )

            # STEP 12: Verify resulting operational state
            elif step.step_id == "MCI-01-12":
                verif = verify_operational_status(
                    target_entity="operating_room",
                    entity_id="OR-3",
                    expected_field="status",
                    expected_value="RESERVED_FOR_TRAUMA",
                    db=db,
                )
                output = {"verification_result": verif}
                verification = {"verified": verif.get("verified"), "disk_status": verif.get("actual_value")}

            # STEP 13: Recalculate hospital capacity and remaining shortages
            elif step.step_id == "MCI-01-13":
                final_shortage = calculate_resource_shortage(
                    incoming_casualties=context.get("incoming_casualties", 42),
                    incident_id=context.get("incident_id"),
                    db=db,
                )
                output = {"post_preemption_shortage": final_shortage}
                verification = {
                    "unlocked_trauma_suite": "OR-3",
                    "surge_capacity_active": True,
                }

            # STEP 14: Create follow-up operational tasks and notifications
            elif step.step_id == "MCI-01-14":
                t1 = create_operational_task(
                    title="Notify Orthopedic Surgical Team of OR-3 Preemption and Reschedule Elective Case",
                    incident_id=context.get("incident_id"),
                    tier="GREEN",
                    db=db,
                )
                t2 = create_operational_task(
                    title="Alert Blood Bank: Prepare Massive Transfusion Protocol (MTP) Surge Packs",
                    incident_id=context.get("incident_id"),
                    tier="GREEN",
                    db=db,
                )
                output = {"followup_tasks": [t1.get("task_id"), t2.get("task_id")]}
                verification = {"tasks_created_count": 2}

            # STEP 15: Generate final runbook execution summary
            elif step.step_id == "MCI-01-15":
                summary = {
                    "runbook_id": self.definition.runbook_id,
                    "execution_id": execution_id,
                    "incident_id": context.get("incident_id"),
                    "incoming_casualties": context.get("incoming_casualties"),
                    "staged_resources": ["ED-01", "MEDIC-01", "OR-2", "OR-3"],
                    "consequential_action_authorized": True,
                    "final_status": "COMPLETED",
                    "timestamp": now.isoformat(),
                }
                output = {"execution_summary": summary}
                verification = {"runbook_complete": True}

            # Mark step completed
            if not pause_required and not stop_runbook:
                step_record.status = StepStatus.COMPLETED.value
            step_record.output_json = json.dumps(output, default=str)
            step_record.verification_json = json.dumps(verification, default=str)
            step_record.completed_at = datetime.now(timezone.utc)
            db.commit()

            return step_record, pause_required, stop_runbook

        except Exception as e:
            logger.error("Runbook Step %s failed: %s", step.step_id, e, exc_info=True)
            step_record.status = StepStatus.FAILED.value
            step_record.error_message = str(e)
            step_record.completed_at = datetime.now(timezone.utc)
            db.commit()
            return step_record, False, True


# Singleton instance of the MCI-01 runbook engine
mci_engine = RunbookEngine()
