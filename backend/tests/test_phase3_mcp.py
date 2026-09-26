"""Focused Phase 3 automated tests verifying Model Context Protocol (MCP) integration and TrueForge vertical slice."""
import json
import pytest
from backend.app.mcp.server import create_mcp_server, get_mcp_server
from backend.app.agent.trueforge_runner import run_trueforge_vertical_slice, extract_payload
from backend.app.services.database import SessionLocal, init_db, OperatingRoomRecord, OperationalTaskRecord


@pytest.fixture(autouse=True)
def setup_test_db():
    """Ensure database is initialized for MCP tests."""
    init_db()


# ==============================================================================
# A & B: MCP SERVER INITIALIZATION & TOOL DISCOVERY
# ==============================================================================
@pytest.mark.anyio
async def test_mcp_server_initialization_and_tool_discovery():
    """Verify MCP server starts and exposes the 6 required operational tools."""
    server = create_mcp_server()
    assert server.name == "aimbulence-hospital-ops"

    tools = await server.list_tools()
    tool_names = [t.name for t in tools]

    expected_tools = [
        "get_hospital_capacity",
        "calculate_resource_shortage",
        "get_resource_status",
        "create_operational_task",
        "reserve_resource",
        "verify_operational_status",
    ]

    for expected in expected_tools:
        assert expected in tool_names, f"Expected tool '{expected}' missing from MCP server"

    # Verify tool descriptions include safety tiers
    tools_dict = {t.name: t for t in tools}
    assert "[SAFETY: GREEN]" in tools_dict["get_hospital_capacity"].description
    assert "[SAFETY: GREEN]" in tools_dict["calculate_resource_shortage"].description
    assert "[SAFETY: YELLOW / RED]" in tools_dict["reserve_resource"].description


# ==============================================================================
# C: get_hospital_capacity REACHES SQLITE VIA MCP
# ==============================================================================
@pytest.mark.anyio
async def test_mcp_get_hospital_capacity_reaches_sqlite():
    """Verify invoking get_hospital_capacity through MCP queries the SQLite database."""
    server = get_mcp_server()
    res = await server.call_tool("get_hospital_capacity", {})
    data = extract_payload(res)

    assert data["status"] == "SUCCESS"
    assert data["hospital_name"] == "Metro Central Trauma Hospital"
    assert data["emergency_beds"]["total"] == 20
    assert data["emergency_beds"]["available"] == 12
    assert data["icu_beds"]["available"] == 4
    assert data["operating_rooms"]["open"] == 2


# ==============================================================================
# D: calculate_resource_shortage(42) RETURNS EXPECTED DEFICIT
# ==============================================================================
@pytest.mark.anyio
async def test_mcp_calculate_resource_shortage_42_casualties():
    """Verify invoking calculate_resource_shortage through MCP computes the 30-bed deficit for 42 casualties."""
    server = get_mcp_server()
    res = await server.call_tool("calculate_resource_shortage", {
        "incoming_casualties": 42,
        "incident_id": "INC-TEST-42",
    })
    data = extract_payload(res)

    assert data["status"] == "SUCCESS"
    assert data["incoming_casualties"] == 42
    # 42 incoming demand - 12 available ED beds = 30 bed deficit!
    assert data["deficits"]["emergency_beds"] == 30
    assert data["deficits"]["icu_beds"] == 4
    assert data["deficits"]["operating_rooms"] == 3
    assert data["has_critical_shortage"] is True


# ==============================================================================
# E: create_operational_task PERSISTS A REAL TASK IN SQLITE
# ==============================================================================
@pytest.mark.anyio
async def test_mcp_create_operational_task_persists():
    """Verify invoking create_operational_task through MCP persists a task in the database."""
    server = get_mcp_server()
    task_title = "MCP Stage Secondary Trauma Area"
    res = await server.call_tool("create_operational_task", {
        "title": task_title,
        "incident_id": "INC-MCP-01",
        "tier": "GREEN",
    })
    data = extract_payload(res)

    assert data["status"] == "SUCCESS"
    assert data["title"] == task_title
    assert data["persisted"] is True
    task_id = data["task_id"]

    # Verify directly in SQLite database
    db = SessionLocal()
    persisted = db.query(OperationalTaskRecord).filter(OperationalTaskRecord.id == task_id).first()
    assert persisted is not None
    assert persisted.title == task_title
    assert persisted.status == "PENDING"
    db.close()


# ==============================================================================
# F: verify_operational_status CONFIRMS PERSISTED STATE
# ==============================================================================
@pytest.mark.anyio
async def test_mcp_verify_operational_status_confirms():
    """Verify verify_operational_status tool accurately checks real DB state."""
    server = get_mcp_server()
    
    # 1. Create a task via MCP
    task_res = await server.call_tool("create_operational_task", {"title": "Verification Target Task"})
    task_data = extract_payload(task_res)
    task_id = task_data["task_id"]

    # 2. Verify it is PENDING
    verif_res = await server.call_tool("verify_operational_status", {
        "target_entity": "task",
        "entity_id": task_id,
        "expected_field": "status",
        "expected_value": "PENDING",
    })
    verif_data = extract_payload(verif_res)
    assert verif_data["verified"] is True
    assert verif_data["status"] == "VERIFIED"
    assert verif_data["actual_value"] == "PENDING"


# ==============================================================================
# G & H: RED ACTION RETURNS APPROVAL_REQUIRED & DOES NOT MUTATE DATABASE
# ==============================================================================
@pytest.mark.anyio
async def test_mcp_red_action_blocked_without_mutation():
    """Verify attempting to reserve/preempt an in-use OR through MCP triggers the RED approval gate without mutation."""
    server = get_mcp_server()

    # Pre-condition check: OR-3 is IN_USE for elective surgery
    db = SessionLocal()
    or3_before = db.query(OperatingRoomRecord).filter(OperatingRoomRecord.room_number == "OR-3").first()
    assert or3_before.status == "IN_USE"
    procedure_before = or3_before.scheduled_procedure
    db.close()

    # Attempt to reserve in-use OR-3 via MCP
    res = await server.call_tool("reserve_resource", {
        "resource_type": "operating_room",
        "resource_id": "OR-3",
        "reason": "Attempt elective cancellation via MCP",
    })
    data = extract_payload(res)

    # Asserts
    assert data["status"] == "APPROVAL_REQUIRED"
    assert data["risk_level"] == "RED"
    assert data["safety_category"] == "RED"
    assert data["requires_human_approval"] is True
    assert "elective surgery" in data["reason"].lower()

    # Post-condition check: Database was NOT mutated!
    db = SessionLocal()
    or3_after = db.query(OperatingRoomRecord).filter(OperatingRoomRecord.room_number == "OR-3").first()
    assert or3_after.status == "IN_USE"
    assert or3_after.scheduled_procedure == procedure_before
    db.close()


# ==============================================================================
# END-TO-END TRUEFORGE VERTICAL SLICE
# ==============================================================================
@pytest.mark.anyio
async def test_trueforge_vertical_slice_end_to_end():
    """Verify the complete TrueForge vertical slice runner executes end-to-end."""
    result = await run_trueforge_vertical_slice(incoming_casualties=42)
    assert result["status"] == "SUCCESS"
    assert result["discovered_tools_count"] == 6
    assert len(result["execution_steps"]) == 5
    assert result["sqlite_persistence_confirmed"] is True
    assert result["red_safety_gate_preserved"] is True
