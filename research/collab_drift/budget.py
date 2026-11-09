"""
Simplified budget tracker for R7 pilot.

Standalone implementation without external dependencies.
"""

import json
import threading
from datetime import datetime
from pathlib import Path
from typing import Dict, Any


class BudgetTracker:
    """Simple budget tracker with JSON ledger."""
    
    def __init__(self, ledger_path: Path):
        self.ledger_path = ledger_path
        self._lock = threading.Lock()
        self._reservations = {}  # call_id -> reserved_usd
        self._spent = []  # List of settled calls
        
        # Ensure ledger exists
        if not ledger_path.exists():
            ledger_path.touch()
    
    def reserve(self, call_id: str, estimated_usd: float):
        """Reserve budget for a call."""
        with self._lock:
            if call_id in self._reservations:
                raise ValueError(f"Call {call_id} already reserved")
            self._reservations[call_id] = estimated_usd
            
            # Log reservation
            self._append_ledger({
                "type": "reserve",
                "call_id": call_id,
                "reserved_usd": estimated_usd,
                "timestamp": datetime.utcnow().isoformat()
            })
    
    def reconcile(self, call_id: str, actual_usd: float, **kwargs):
        """Settle actual cost for a call."""
        with self._lock:
            if call_id not in self._reservations:
                # Unknown call, record as hold
                self._spent.append({
                    "call_id": call_id,
                    "actual_usd": actual_usd,
                    "status": "unknown",
                    **kwargs
                })
                self._append_ledger({
                    "type": "reconcile_unknown",
                    "call_id": call_id,
                    "actual_usd": actual_usd,
                    "timestamp": datetime.utcnow().isoformat()
                })
                return
            
            # Remove reservation, add to spent
            reserved = self._reservations.pop(call_id)
            self._spent.append({
                "call_id": call_id,
                "reserved_usd": reserved,
                "actual_usd": actual_usd,
                "status": "settled",
                **kwargs
            })
            
            # Log settlement
            self._append_ledger({
                "type": "reconcile",
                "call_id": call_id,
                "reserved_usd": reserved,
                "actual_usd": actual_usd,
                "timestamp": datetime.utcnow().isoformat()
            })
    
    def get_committed(self) -> float:
        """Return total committed (spent + reserved)."""
        with self._lock:
            spent_total = sum(c["actual_usd"] for c in self._spent)
            reserved_total = sum(self._reservations.values())
            return spent_total + reserved_total
    
    def _append_ledger(self, entry: Dict[str, Any]):
        """Append entry to JSON ledger."""
        with open(self.ledger_path, 'a') as f:
            f.write(json.dumps(entry) + '\n')
