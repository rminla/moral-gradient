"""
Stage budget enforcement wrapper.

Enforces incremental stage cap above locked baseline (including unreconciled holds).
Prevents pilot from spending more than $5 beyond $2.2036 baseline.

FIXED R4 BUG: Track exact reservations by call_id to prevent in-flight leaks.
"""

from pathlib import Path
from typing import Dict, Optional
import threading

from lib.budget import BudgetTracker, BudgetExceededError


class StageBudgetEnforcer:
    """
    Wraps BudgetTracker to enforce stage-level incremental budget.
    
    Global cap: $70 (absolute)
    Baseline locked: Computed from ledger at init (reserved + spent)
    Stage cap: $5 (incremental above baseline)
    
    Per-call atomic check: stage_spent + stage_reserved + worst_case <= stage_cap
    
    CRITICAL FIX: Tracks exact reservation per call_id, releases ORIGINAL reserved
    amount on settlement (not actual cost), prevents in-flight leak.
    """
    
    def __init__(
        self,
        budget_tracker: BudgetTracker,
        stage_cap_usd: float,
        baseline_locked_usd: Optional[float] = None,
        per_call_ceiling_usd: Optional[float] = None
    ):
        """
        Initialize stage budget enforcer.
        
        Args:
            budget_tracker: Underlying budget tracker
            stage_cap_usd: Incremental cap for this stage (e.g. $5.00)
            baseline_locked_usd: Optional override (if None, computed from ledger)
            per_call_ceiling_usd: Optional per-call worst-case ceiling (e.g. $0.50 for canary)
        """
        self.budget_tracker = budget_tracker
        self.stage_cap_usd = stage_cap_usd
        self.per_call_ceiling_usd = per_call_ceiling_usd
        
        # Compute baseline from ledger if not provided
        if baseline_locked_usd is None:
            status = budget_tracker.get_status()
            self.baseline_locked_usd = status.global_reserved_usd + status.global_spent_usd
        else:
            self.baseline_locked_usd = baseline_locked_usd
        
        self.stage_spent_usd = 0.0
        self._reservations: Dict[str, float] = {}  # Track exact reserved amount per call_id
        self._lock = threading.Lock()  # Thread-safe reservation tracking
    
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
        1. Per-call ceiling (if set): worst_case <= per_call_ceiling
        2. Stage cap: stage_spent + sum(in-flight) + worst_case <= stage_cap
        3. Global cap (absolute) - checked by underlying tracker
        
        Raises:
            BudgetExceededError: If any cap would be exceeded
        """
        with self._lock:
            # Check per-call ceiling first (canary mode)
            if self.per_call_ceiling_usd is not None and worst_case_usd > self.per_call_ceiling_usd:
                raise BudgetExceededError(
                    f"Per-call ceiling exceeded: "
                    f"requested ${worst_case_usd:.4f}, "
                    f"per-call ceiling ${self.per_call_ceiling_usd:.2f} (canary mode)"
                )
            
            # Compute current in-flight total from tracked reservations
            stage_reserved_total = sum(self._reservations.values())
            
            # Check stage cap including in-flight reservations
            stage_total = self.stage_spent_usd + stage_reserved_total + worst_case_usd
            if stage_total > self.stage_cap_usd:
                raise BudgetExceededError(
                    f"Stage budget exceeded: "
                    f"stage spent ${self.stage_spent_usd:.4f}, "
                    f"stage reserved ${stage_reserved_total:.4f} ({len(self._reservations)} calls), "
                    f"requested ${worst_case_usd:.4f}, "
                    f"stage cap ${self.stage_cap_usd:.2f}, "
                    f"baseline locked ${self.baseline_locked_usd:.4f}"
                )
            
            # Reserve in underlying tracker (checks global cap)
            reservation = self.budget_tracker.reserve(
                call_id=call_id,
                model_id=model_id,
                provider=provider,
                worst_case_usd=worst_case_usd
            )
            
            # Track exact reservation for this call_id
            self._reservations[call_id] = worst_case_usd
            
            return reservation
    
    def reconcile(
        self,
        call_id: str,
        model_version,
        prompt_tokens: int,
        completion_tokens: int,
        actual_cost_usd: float,
        duration_ms: int,
        experiment: str,
        metadata=None,
        error=None,
        finish_reason=None
    ):
        """
        Reconcile reservation with actual cost.
        
        CRITICAL: Releases ORIGINAL reserved amount (not actual), adds actual to spent.
        Prevents in-flight leak where stage_reserved would inflate 3x over time.
        
        If call_id not found in reservations (shouldn't happen), logs warning but continues.
        Unknown failures leave hold persisting in global ledger (correct behavior).
        """
        with self._lock:
            # Get original reserved amount for this call
            original_reserved = self._reservations.pop(call_id, None)
            
            if original_reserved is None:
                # Shouldn't happen - reconciling unknown call_id
                # Log but don't fail (stage accounting may be slightly off)
                import logging
                logging.warning(f"Reconciling unknown call_id {call_id} - not in stage reservations")
            
            # Pass through to underlying tracker with full kwargs
            self.budget_tracker.reconcile(
                call_id=call_id,
                model_version=model_version,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                actual_cost_usd=actual_cost_usd,
                duration_ms=duration_ms,
                experiment=experiment,
                metadata=metadata,
                error=error,
                finish_reason=finish_reason
            )
            
            # Update stage accounting: release original reserved, add actual to spent
            # Do NOT decrement by actual_cost - that causes leak
            # Reservation already removed from dict above
            self.stage_spent_usd += actual_cost_usd
    
    def get_status(self):
        """Get budget status including stage tracking."""
        global_status = self.budget_tracker.get_status()
        
        with self._lock:
            # Compute stage_reserved from exact tracked reservations
            stage_reserved_usd = sum(self._reservations.values())
            stage_used = self.stage_spent_usd + stage_reserved_usd
        
        return {
            "global_cap_usd": global_status.global_cap_usd,
            "global_reserved_usd": global_status.global_reserved_usd,
            "global_spent_usd": global_status.global_spent_usd,
            "global_available_usd": global_status.global_available_usd,
            "baseline_locked_usd": self.baseline_locked_usd,
            "stage_cap_usd": self.stage_cap_usd,
            "stage_spent_usd": self.stage_spent_usd,
            "stage_reserved_usd": stage_reserved_usd,
            "stage_reserved_calls": len(self._reservations),
            "stage_used_usd": stage_used,
            "stage_available_usd": self.stage_cap_usd - stage_used,
            "by_provider": global_status.by_provider
        }
    
    def check_call_exists(self, call_id: str) -> bool:
        """Check if call already exists."""
        return self.budget_tracker.check_call_exists(call_id)
