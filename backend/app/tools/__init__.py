"""AIMBULENCE Operational Tool Layer.

This package exposes tools for reading hospital operational capacity,
calculating mass-casualty resource deficits, reserving available assets,
proposing high-impact consequential actions with strict RED safety gating,
creating internal operational tasks, and verifying real persisted system state.
"""
from backend.app.tools.exceptions import (
    ToolError,
    ResourceNotFoundError,
    InsufficientCapacityError,
    DuplicateReservationError,
    InvalidQuantityError,
    InvalidResourceTypeError,
    StaleStateError,
    UnauthorizedRedActionError,
    DatabaseFailureError,
)
from backend.app.tools.audit_helper import log_tool_audit
from backend.app.tools.hospital_tools import (
    get_hospital_capacity,
    calculate_resource_shortage,
)
from backend.app.tools.resource_tools import (
    get_resource_status,
    reserve_resource,
    propose_consequential_action,
    execute_consequential_action,
)
from backend.app.tools.task_tools import (
    create_operational_task,
    get_operational_tasks,
)
from backend.app.tools.verification_tools import (
    verify_operational_status,
)

__all__ = [
    # Exceptions
    "ToolError",
    "ResourceNotFoundError",
    "InsufficientCapacityError",
    "DuplicateReservationError",
    "InvalidQuantityError",
    "InvalidResourceTypeError",
    "StaleStateError",
    "UnauthorizedRedActionError",
    "DatabaseFailureError",
    # Audit
    "log_tool_audit",
    # Tools
    "get_hospital_capacity",
    "calculate_resource_shortage",
    "get_resource_status",
    "reserve_resource",
    "propose_consequential_action",
    "execute_consequential_action",
    "create_operational_task",
    "get_operational_tasks",
    "verify_operational_status",
]
