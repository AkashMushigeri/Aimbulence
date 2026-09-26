"""AIMBULENCE TrueForge Human-in-the-Loop Approval Checkpoint module.

Exposes checkpoint models and the TrueForgeApprovalManager singleton for managing
consequential (RED) operational pauses, single-use token binding, human authorizations,
and post-execution state verification.
"""
from backend.app.approval.checkpoint import (
    ApprovalDecisionPayload,
    ApprovalDecisionType,
    CheckpointState,
    RedActionProposal,
    TrueForgeApprovalCheckpoint,
    TrueForgeApprovalManager,
    approval_manager,
)

__all__ = [
    "ApprovalDecisionPayload",
    "ApprovalDecisionType",
    "CheckpointState",
    "RedActionProposal",
    "TrueForgeApprovalCheckpoint",
    "TrueForgeApprovalManager",
    "approval_manager",
]
