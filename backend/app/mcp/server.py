"""AIMBULENCE Model Context Protocol (MCP) Server.

Exposes the Phase 2 operational hospital tools over the standard Model Context
Protocol (MCP) interface for the TrueForge agent harness.
All tools operate on the real persistent SQLite operational database.
"""
from typing import Any, Dict, Optional
from mcp.server.mcpserver import MCPServer

from backend.app.tools import (
    get_hospital_capacity as py_get_hospital_capacity,
    calculate_resource_shortage as py_calculate_resource_shortage,
    get_resource_status as py_get_resource_status,
    create_operational_task as py_create_operational_task,
    reserve_resource as py_reserve_resource,
    verify_operational_status as py_verify_operational_status,
)


def create_mcp_server() -> MCPServer:
    """Create and configure the AIMBULENCE MCP Server with all operational tools."""
    server = MCPServer(
        name="aimbulence-hospital-ops",
        instructions="Operational tools for hospital emergency surge capacity, resource reservation, and verification during mass-casualty incidents.",
        version="0.1.0",
    )

    # ==========================================================================
    # TOOL 1: get_hospital_capacity (GREEN)
    # ==========================================================================
    @server.tool(
        name="get_hospital_capacity",
        description="[SAFETY: GREEN] Read the current emergency operational capacity from the persistent database. Returns live emergency beds, ICU beds, operating rooms, staffing, ambulances, and blood inventory.",
    )
    def get_hospital_capacity() -> Dict[str, Any]:
        return py_get_hospital_capacity()

    # ==========================================================================
    # TOOL 2: calculate_resource_shortage (GREEN)
    # ==========================================================================
    @server.tool(
        name="calculate_resource_shortage",
        description="[SAFETY: GREEN] Calculate emergency bed, ICU, surgical suite, and blood deficits against incoming casualty demand from current live database state.",
    )
    def calculate_resource_shortage(
        incoming_casualties: int,
        incident_id: str = "",
        acute_ratio: float = 0.5,
    ) -> Dict[str, Any]:
        return py_calculate_resource_shortage(
            incoming_casualties=incoming_casualties,
            incident_id=incident_id or None,
            acute_ratio=acute_ratio,
        )

    # ==========================================================================
    # TOOL 3: get_resource_status (GREEN)
    # ==========================================================================
    @server.tool(
        name="get_resource_status",
        description="[SAFETY: GREEN] Return granular operational status for specific hospital assets (bed, operating_room, staff, ambulance, blood).",
    )
    def get_resource_status(resource_type: str = "") -> Dict[str, Any]:
        return py_get_resource_status(resource_type=resource_type or None)

    # ==========================================================================
    # TOOL 4: create_operational_task (GREEN)
    # ==========================================================================
    @server.tool(
        name="create_operational_task",
        description="[SAFETY: GREEN] Persist an internal operational coordination task in the database (e.g. 'Prepare triage area', 'Alert trauma staff').",
    )
    def create_operational_task(
        title: str,
        incident_id: str = "",
        tier: str = "GREEN",
    ) -> Dict[str, Any]:
        return py_create_operational_task(
            title=title,
            incident_id=incident_id or None,
            tier=tier,
        )

    # ==========================================================================
    # TOOL 5: reserve_resource (YELLOW / RED Gate)
    # ==========================================================================
    @server.tool(
        name="reserve_resource",
        description="[SAFETY: YELLOW / RED] Reserve an available resource (bed, ambulance, open OR). Attempting to preempt an in-use surgical suite is a high-consequence RED action that halts for human approval without mutating state.",
    )
    def reserve_resource(
        resource_type: str,
        resource_id: str,
        incident_id: str = "",
        reason: str = "Emergency allocation",
    ) -> Dict[str, Any]:
        return py_reserve_resource(
            resource_type=resource_type,
            resource_id=resource_id,
            incident_id=incident_id or None,
            reason=reason,
        )

    # ==========================================================================
    # TOOL 6: verify_operational_status (GREEN)
    # ==========================================================================
    @server.tool(
        name="verify_operational_status",
        description="[SAFETY: GREEN] Query the database post-execution and verify whether the expected operational state was actually reached on disk.",
    )
    def verify_operational_status(
        target_entity: str,
        entity_id: str,
        expected_field: str,
        expected_value: Any,
    ) -> Dict[str, Any]:
        # Handle stringified boolean values from JSON-RPC
        val = expected_value
        if isinstance(expected_value, str):
            if expected_value.lower() == "true":
                val = True
            elif expected_value.lower() == "false":
                val = False

        return py_verify_operational_status(
            target_entity=target_entity,
            entity_id=entity_id,
            expected_field=expected_field,
            expected_value=val,
        )

    return server


_default_server: Optional[MCPServer] = None


def get_mcp_server() -> MCPServer:
    """Return singleton instance of the configured AIMBULENCE MCP server."""
    global _default_server
    if _default_server is None:
        _default_server = create_mcp_server()
    return _default_server


# ASGI application instance for SSE transport (e.g. uvicorn backend.app.mcp.server:app)
app = get_mcp_server().sse_app()

if __name__ == "__main__":
    import asyncio
    server = get_mcp_server()
    asyncio.run(server.run_stdio_async())
