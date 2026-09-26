"""Explicit exception hierarchy for AIMBULENCE operational tools."""


class ToolError(Exception):
    """Base exception for all operational tool failures."""
    def __init__(self, message: str, details: dict = None):
        super().__init__(message)
        self.message = message
        self.details = details or {}


class ResourceNotFoundError(ToolError):
    """Raised when an asset, bed, room, staff, or task cannot be found."""
    pass


class InsufficientCapacityError(ToolError):
    """Raised when attempting to allocate more resources than available or when a resource is occupied."""
    pass


class DuplicateReservationError(ToolError):
    """Raised when attempting to reserve a resource that is already reserved."""
    pass


class InvalidQuantityError(ToolError):
    """Raised when an invalid numerical quantity (e.g. non-positive count) is supplied."""
    pass


class InvalidResourceTypeError(ToolError):
    """Raised when an unsupported resource type identifier is requested."""
    pass


class StaleStateError(ToolError):
    """Raised when concurrent mutation conflicts with current database state."""
    pass


class UnauthorizedRedActionError(ToolError):
    """Raised when execution of a high-consequence (RED) action is attempted without authorization."""
    pass


class DatabaseFailureError(ToolError):
    """Raised when a transactional database operation encounters an unrecoverable failure."""
    pass
