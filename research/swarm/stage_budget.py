"""
Stage budget enforcement wrapper.

Enforces incremental stage cap above locked baseline (including unreconciled holds).
Prevents pilot from spending more than $5 beyond $2.2036 baseline.
"""

from pathlib import Path
from typing import Optional

from lib.budget import BudgetTracker, BudgetExceededError


class StageBudgetEnforcer:
    """
    Wraps BudgetTracker to enforce stage-level incremental budget.
    
    Global cap: $70 (absolute)
    Baseline locked: $2.2036 (including 79 unreconciled holds)
    Stage cap: $5 (incremental above baseline)
    
    Per-call atomic check: baseline + stage_spent + worst_case <= baseline + stage_cap
    """
    
    def __init__(
        self,
        budget_tracker: BudgetTracker,
        baseline_locked_usd: float,
        stage_cap_usd: float
    ):
        """
        Initialize stage budget enforcer.
        
        Args:
            budget_tracker: Underlying budget tracker
            baseline_locked_usd: Locked baseline including all holds (e.g. $2.2036)
            stage_cap_usd: Incremental cap for this stage (e.g. $5.00)
        """
        self.budget_tracker = budget_tracker
        self.baseline_locked_usd = baseline_locked_usd
        self.stage_cap_usd = stage_cap_usd
        self.stage_spent_usd = 0.0
    
    def reserve(
        self,
        call_id: str,
        model_id: str,
        provider,
        worst_case_usd: float
    ):
        """
        Reserve budget with stage cap enforcement.
        
        Checks:
        1. Global cap (absolute)
        2. Stage cap (incremental above baseline)
        
        Raises:
            BudgetExceededError: If either cap would be exceeded
        """
        # Check stage cap BEFORE calling underlying reserve
        if self.stage_spent_usd + worst_case_usd > self.stage_cap_usd:
            raise BudgetExceededError(
                f"Stage budget exceeded: "
                f"stage spent ${self.stage_spent_usd:.4f}, "
                f"requested ${worst_case_usd:.4f}, "
                f"stage cap ${self.stage_cap_usd:.2f}, "
                f"baseline locked ${self.baseline_locked_usd:.4f}"
            )
        
        # Underlying reserve checks global cap
        reservation = self.budget_tracker.reserve(
            call_id=call_id,
            model_id=model_id,
            provider=provider,
            worst_case_usd=worst_case_usd
        )
        
        return reservation
    
    def reconcile(self, call_id: str, actual_cost_usd: float):
        """Reconcile reservation with actual cost."""
        self.budget_tracker.reconcile(call_id, actual_cost_usd)
        self.stage_spent_usd += actual_cost_usd
    
    def get_status(self):
        """Get budget status including stage tracking."""
        global_status = self.budget_tracker.get_status()
        
        return {
            "global_cap_usd": global_status.global_cap_usd,
            "global_reserved_usd": global_status.global_reserved_usd,
            "global_spent_usd": global_status.global_spent_usd,
            "global_available_usd": global_status.global_available_usd,
            "baseline_locked_usd": self.baseline_locked_usd,
            "stage_cap_usd": self.stage_cap_usd,
            "stage_spent_usd": self.stage_spent_usd,
            "stage_available_usd": self.stage_cap_usd - self.stage_spent_usd,
            "by_provider": global_status.by_provider
        }
    
    def check_call_exists(self, call_id: str) -> bool:
        """Check if call already exists."""
        return self.budget_tracker.check_call_exists(call_id)
