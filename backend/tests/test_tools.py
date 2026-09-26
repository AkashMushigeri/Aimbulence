"""Automated test suite for AIMBULENCE Phase 2 Operational Tool Layer."""
import os
import tempfile
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.app.services.database import (
    Base,
    init_db,
    BedRecord,
    OperatingRoomRecord,
    AmbulanceRecord,
    OperationalTaskRecord,
    AuditEventRecord,
)
from backend.app.tools import (
    get_hospital_capacity,
    calculate_resource_shortage,
    get_resource_status,
    reserve_resource,
    propose_consequential_action,
    execute_consequential_action,
    create_operational_task,
    get_operational_tasks,
    verify_operational_status,
    ResourceNotFoundError,
    InsufficientCapacityError,
    DuplicateReservationError,
    InvalidQuantityError,
    InvalidResourceTypeError,
    UnauthorizedRedActionError,
)


@pytest.fixture
def test_db():
    """Provides an isolated temporary SQLite database populated with synthetic baseline data."""
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp_file:
        db_path = tmp_file.name

    test_db_url = f"sqlite:///{db_path}"
    test_engine = create_engine(test_db_url, connect_args={"check_same_thread": False})
    
    init_db(engine_instance=test_engine)
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
    session = TestingSession()

    yield session, test_engine, db_path

    session.close()
    test_engine.dispose()
    if os.path.exists(db_path):
        try:
            os.remove(db_path)
        except Exception:
            pass


# ==============================================================================
# 1. get_hospital_capacity reads real database state
# ==============================================================================
def test_get_hospital_capacity_reads_real_db(test_db):
    session, _, _ = test_db
    capacity = get_hospital_capacity(db=session)

    assert capacity["status"] == "SUCCESS"
    assert capacity["hospital_name"] == "Metro Central Trauma Hospital"
    assert capacity["operational_code"] == "NORMAL"
    assert capacity["safety_category"] == "GREEN"

    # Verify counts match baseline seed
    assert capacity["emergency_beds"]["total"] == 20
    assert capacity["emergency_beds"]["available"] == 12
    assert capacity["emergency_beds"]["occupied"] == 8
    assert capacity["icu_beds"]["total"] == 10
    assert capacity["icu_beds"]["available"] == 4
    assert capacity["operating_rooms"]["total"] == 5
    assert capacity["operating_rooms"]["open"] == 2
    assert capacity["operating_rooms"]["in_use"] == 3
    assert capacity["ambulances"]["available"] == 5
    assert capacity["blood_inventory"]["total_units"] == 30
    assert capacity["blood_inventory"]["o_negative_units"] == 18


# ==============================================================================
# 2. calculate_resource_shortage performs actual calculation
# ==============================================================================
def test_calculate_resource_shortage_calculation(test_db):
    session, _, _ = test_db
    
    # 42 incoming casualties against 12 available ED beds
    result = calculate_resource_shortage(incoming_casualties=42, db=session)
    
    assert result["status"] == "SUCCESS"
    assert result["incoming_casualties"] == 42
    assert result["safety_category"] == "GREEN"
    
    # 42 incoming - 12 available ED beds = 30 bed deficit!
    assert result["deficits"]["emergency_beds"] == 30
    assert result["current_capacity"]["emergency_beds_available"] == 12
    
    # ICU deficit: 42 * 0.20 = 8 demand vs 4 available = 4 deficit
    assert result["deficits"]["icu_beds"] == 4
    
    # OR deficit: 42 * 0.12 = 5 demand vs 2 open = 3 deficit
    assert result["deficits"]["operating_rooms"] == 3

    assert result["has_critical_shortage"] is True
    assert len(result["recommended_actions"]) >= 3


def test_calculate_resource_shortage_invalid_quantity(test_db):
    session, _, _ = test_db
    with pytest.raises(InvalidQuantityError):
        calculate_resource_shortage(incoming_casualties=0, db=session)
    with pytest.raises(InvalidQuantityError):
        calculate_resource_shortage(incoming_casualties=-10, db=session)


# ==============================================================================
# 3. create_operational_task persists a task
# ==============================================================================
def test_create_operational_task_persists(test_db):
    session, _, _ = test_db
    
    task_res = create_operational_task(
        title="Prepare emergency triage intake staging bay",
        incident_id="INC-TEST-001",
        tier="GREEN",
        details={"intake_area": "Hallway 2A", "nurses_assigned": 4},
        db=session,
    )

    assert task_res["status"] == "SUCCESS"
    assert task_res["task_id"].startswith("TASK-")
    assert task_res["title"] == "Prepare emergency triage intake staging bay"
    assert task_res["tier"] == "GREEN"
    assert task_res["safety_category"] == "GREEN"
    assert task_res["persisted"] is True

    # Verify queryable from DB
    persisted_task = session.query(OperationalTaskRecord).filter(
        OperationalTaskRecord.id == task_res["task_id"]
    ).first()
    assert persisted_task is not None
    assert persisted_task.status == "PENDING"

    # Verify queryable via tool
    tasks_list = get_operational_tasks(incident_id="INC-TEST-001", db=session)
    assert len(tasks_list) == 1
    assert tasks_list[0]["task_id"] == task_res["task_id"]


# ==============================================================================
# 4. reserve_resource succeeds when resource is available
# ==============================================================================
def test_reserve_resource_success_available(test_db):
    session, _, _ = test_db
    
    # ED-01 is an available emergency bed in baseline
    res = reserve_resource(
        resource_type="bed",
        resource_id="ED-01",
        incident_id="INC-TEST-001",
        reason="Assigned to arriving trauma patient 1",
        db=session,
    )

    assert res["status"] == "SUCCESS"
    assert res["safety_category"] == "YELLOW"
    assert res["resource_code"] == "ED-01"
    assert res["previous_state"]["is_reserved"] is False
    assert res["new_state"]["is_reserved"] is True

    # Verify in DB
    bed = session.query(BedRecord).filter(BedRecord.bed_code == "ED-01").first()
    assert bed.is_reserved is True

    # Reserving open OR (OR-1) succeeds
    or_res = reserve_resource(
        resource_type="operating_room",
        resource_id="OR-1",
        incident_id="INC-TEST-001",
        reason="Surge trauma surgery",
        db=session,
    )
    assert or_res["status"] == "SUCCESS"
    assert or_res["new_state"]["status"] == "RESERVED_FOR_TRAUMA"


# ==============================================================================
# 5. reserve_resource fails when resource is unavailable
# ==============================================================================
def test_reserve_resource_fails_unavailable(test_db):
    session, _, _ = test_db
    
    # Case A: Bed is already occupied (ED-15 is occupied in baseline)
    with pytest.raises(InsufficientCapacityError):
        reserve_resource(resource_type="bed", resource_id="ED-15", db=session)

    # Case B: Duplicate reservation (reserve ED-02 twice)
    reserve_resource(resource_type="bed", resource_id="ED-02", db=session)
    with pytest.raises(DuplicateReservationError):
        reserve_resource(resource_type="bed", resource_id="ED-02", db=session)

    # Case C: Resource not found
    with pytest.raises(ResourceNotFoundError):
        reserve_resource(resource_type="bed", resource_id="NON-EXISTENT-BED", db=session)

    # Case D: Invalid resource type
    with pytest.raises(InvalidResourceTypeError):
        reserve_resource(resource_type="helicopter", resource_id="HELI-1", db=session)


# ==============================================================================
# 6. reserve_resource persists the state change
# ==============================================================================
def test_reserve_resource_persists_state_change(test_db):
    session, _, _ = test_db
    
    # Reserve MEDIC-01 ambulance
    res = reserve_resource(
        resource_type="ambulance",
        resource_id="MEDIC-01",
        incident_id="INC-TEST-001",
        reason="Dispatched to highway crash site",
        db=session,
    )
    assert res["status"] == "SUCCESS"
    assert res["new_state"]["status"] == "DISPATCHED"

    # Query directly from DB
    amb = session.query(AmbulanceRecord).filter(AmbulanceRecord.vehicle_code == "MEDIC-01").first()
    assert amb.status == "DISPATCHED"


# ==============================================================================
# 7. verify_operational_status detects the actual state
# ==============================================================================
def test_verify_operational_status_accuracy(test_db):
    session, _, _ = test_db
    
    # Initial state: ED-03 is not reserved
    check_initial = verify_operational_status(
        target_entity="bed",
        entity_id="ED-03",
        expected_field="is_reserved",
        expected_value=False,
        db=session,
    )
    assert check_initial["verified"] is True
    assert check_initial["status"] == "VERIFIED"
    assert check_initial["actual_value"] is False

    # Perform action: reserve ED-03
    reserve_resource(resource_type="bed", resource_id="ED-03", db=session)

    # Verify new state matches expected True
    check_after = verify_operational_status(
        target_entity="bed",
        entity_id="ED-03",
        expected_field="is_reserved",
        expected_value=True,
        db=session,
    )
    assert check_after["verified"] is True
    assert check_after["status"] == "VERIFIED"
    assert check_after["actual_value"] is True

    # Deliberate negative test: Expect False when it is actually True
    check_mismatch = verify_operational_status(
        target_entity="bed",
        entity_id="ED-03",
        expected_field="is_reserved",
        expected_value=False,  # Intentionally false expectation
        db=session,
    )
    assert check_mismatch["verified"] is False
    assert check_mismatch["status"] == "VERIFICATION_FAILED"
    assert check_mismatch["matched"] is False


# ==============================================================================
# 8. RED action cannot execute without authorization & triggers safety gate
# ==============================================================================
def test_red_action_safety_gate_and_rejection(test_db):
    session, _, _ = test_db
    
    # Case A: OR-3 is currently IN_USE with an elective procedure
    # Calling reserve_resource on an in-use OR must HARD STOP and NOT mutate state!
    red_attempt = reserve_resource(
        resource_type="operating_room",
        resource_id="OR-3",
        incident_id="INC-MCI-42",
        reason="Preempt room for incoming acute trauma surgery",
        db=session,
    )

    # Must return APPROVAL_REQUIRED, risk_level RED, and NOT mutate the database!
    assert red_attempt["status"] == "APPROVAL_REQUIRED"
    assert red_attempt["risk_level"] == "RED"
    assert red_attempt["safety_category"] == "RED"
    assert red_attempt["requires_human_approval"] is True
    assert "elective surgery" in red_attempt["reason"].lower()

    # Verify OR-3 was NOT mutated in the database
    or3_record = session.query(OperatingRoomRecord).filter(OperatingRoomRecord.room_number == "OR-3").first()
    assert or3_record.status == "IN_USE"
    assert or3_record.scheduled_procedure == "Elective Arthroscopic Knee Debridement"

    # Case B: Proposing consequential action
    proposal = propose_consequential_action(
        action_name="CANCEL_ELECTIVE_PROCEDURES",
        target_resource="OR-3, OR-4, OR-5",
        reason="Unlock 3 surgical suites to resolve trauma surgery deficit",
        incident_id="INC-MCI-42",
        db=session,
    )
    assert proposal["status"] == "APPROVAL_REQUIRED"
    assert proposal["risk_level"] == "RED"
    assert proposal["requires_human_approval"] is True

    # Case C: Attempting execution of RED action without authorization raises UnauthorizedRedActionError
    with pytest.raises(UnauthorizedRedActionError):
        execute_consequential_action(
            action_id=proposal["action_id"],
            action_name="CANCEL_ELECTIVE_PROCEDURES",
            target_resource="OR-3",
            authorization_token=None,  # Missing authorization!
            db=session,
        )


# ==============================================================================
# 9. Every mutation creates an audit event
# ==============================================================================
def test_every_mutation_creates_audit_event(test_db):
    session, _, _ = test_db
    
    initial_audit_count = session.query(AuditEventRecord).count()

    # Mutation 1: create task
    create_operational_task(title="Deploy emergency stretcher bay", db=session)
    count_after_task = session.query(AuditEventRecord).count()
    assert count_after_task == initial_audit_count + 1

    # Mutation 2: reserve bed
    reserve_resource(resource_type="bed", resource_id="ED-04", db=session)
    count_after_bed = session.query(AuditEventRecord).count()
    assert count_after_bed == initial_audit_count + 2

    # Mutation 3: blocked RED action attempt also logs an audit event
    reserve_resource(resource_type="operating_room", resource_id="OR-4", db=session)
    count_after_blocked = session.query(AuditEventRecord).count()
    assert count_after_blocked == initial_audit_count + 3

    # Inspect last audit record
    last_audit = (
        session.query(AuditEventRecord)
        .order_by(AuditEventRecord.timestamp.desc())
        .first()
    )
    assert last_audit.event_type == "CONSEQUENTIAL_ACTION_BLOCKED"
    assert last_audit.tier == "RED"


# ==============================================================================
# 10. State survives database restart
# ==============================================================================
def test_tool_state_survives_db_restart(test_db):
    session, test_engine, db_path = test_db
    
    # 1. Mutate state: reserve ED-05 and create task
    reserve_resource(resource_type="bed", resource_id="ED-05", reason="Pre-staged", db=session)
    task_res = create_operational_task(title="Persistent Staging Task", db=session)
    session.close()

    # 2. Simulate process shutdown by disposing engine
    test_engine.dispose()

    # 3. Create fresh new engine pointing to same persistent SQLite file
    new_engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
    NewSession = sessionmaker(autocommit=False, autoflush=False, bind=new_engine)
    new_session = NewSession()

    # 4. Verify mutations survive through tools on the new session
    verif_bed = verify_operational_status(
        target_entity="bed",
        entity_id="ED-05",
        expected_field="is_reserved",
        expected_value=True,
        db=new_session,
    )
    assert verif_bed["verified"] is True
    assert verif_bed["actual_value"] is True

    verif_task = verify_operational_status(
        target_entity="task",
        entity_id=task_res["task_id"],
        expected_field="status",
        expected_value="PENDING",
        db=new_session,
    )
    assert verif_task["verified"] is True

    new_session.close()
    new_engine.dispose()
