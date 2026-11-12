"""
Persistent budget tracker for R7 pilot - AUDIT FIX #3.

Loads state from ledger on init, persists across restarts.
Tracks spent and reserved separately with full reconciliation.
"""

import json
import threading
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Set


class BudgetTracker:
    """Persistent budget tracker with JSON ledger (survives restarts)."""
    
    def __init__(self, ledger_path: Path):
        self.ledger_path = ledger_path
        self._lock = threading.Lock()
        self._reservations = {}  # call_id -> reserved_usd
        self._spent = []  # List of settled calls
        self._settled_ids: Set[str] = set()  # Track settled call IDs
        
        # Load state from ledger if exists
        if ledger_path.exists():
            self._load_from_ledger()
        else:
            # Create new ledger
            ledger_path.parent.mkdir(parents=True, exist_ok=True)
            ledger_path.touch()
    
    def _load_from_ledger(self):
        """Restore state from ledger (for restarts)."""
        with open(self.ledger_path, 'r') as f:
            for line in f:
                if not line.strip():
                    continue
                entry = json.loads(line)
                
                if entry["type"] == "reserve":
                    # Active reservation
                    call_id = entry["call_id"]
                    if call_id not in self._settled_ids:
                        self._reservations[call_id] = entry["reserved_usd"]
                
                elif entry["type"] == "reconcile":
                    # Settled reservation
                    call_id = entry["call_id"]
                    if call_id in self._reservations:
                        del self._reservations[call_id]
                    self._spent.append({
                        "call_id": call_id,
                        "reserved_usd": entry["reserved_usd"],
                        "actual_usd": entry["actual_usd"],
                        "status": "settled"
                    })
                    self._settled_ids.add(call_id)
                
                elif entry["type"] == "reconcile_unknown":
                    # Unknown/hold
                    call_id = entry["call_id"]
                    self._spent.append({
                        "call_id": call_id,
                        "actual_usd": entry["actual_usd"],
                        "status": "unknown"
                    })
                    self._settled_ids.add(call_id)
    
    def reserve(self, call_id: str, estimated_usd: float):
        """Reserve budget for a call."""
        with self._lock:
            if call_id in self._reservations or call_id in self._settled_ids:
                raise ValueError(f"Call ID {call_id} already used")
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
                self._settled_ids.add(call_id)
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
            self._settled_ids.add(call_id)
            
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
    
    def get_spent(self) -> float:
        """Return total spent (settled only)."""
        with self._lock:
            return sum(c["actual_usd"] for c in self._spent)
    
    def get_reserved(self) -> float:
        """Return total reserved (in-flight)."""
        with self._lock:
            return sum(self._reservations.values())
    
    def _append_ledger(self, entry: Dict[str, Any]):
        """Append entry to JSON ledger."""
        with open(self.ledger_path, 'a') as f:
            f.write(json.dumps(entry) + '\n')
