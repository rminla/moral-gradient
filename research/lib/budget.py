"""Budget tracking and atomic reservation system.

This module ensures we never exceed the approved budget cap by:
1. Atomically reserving worst-case cost before each API call
2. Reconciling actual cost after call completes
3. Tracking per-provider and global spending
4. Providing checkpoint/resume capability
"""

import sqlite3
import threading
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional, Tuple

from .models import Provider, estimate_cost


@dataclass
class Reservation:
    """A reserved budget allocation."""
    reservation_id: int
    call_id: str
    model_id: str
    provider: str
    reserved_usd: float
    created_at: str


@dataclass
class BudgetStatus:
    """Current budget status."""
    global_cap_usd: float
    global_reserved_usd: float
    global_spent_usd: float
    global_available_usd: float
    by_provider: Dict[str, Dict[str, float]]


class BudgetTracker:
    """
    Thread-safe budget tracking with atomic reservations.
    
    Ensures we never exceed budget cap by reserving worst-case cost
    before making API calls, then reconciling actual cost after.
    """
    
    def __init__(self, db_path: Path, global_cap_usd: float):
        """
        Initialize budget tracker.
        
        Args:
            db_path: Path to SQLite ledger database
            global_cap_usd: Global hard cap in USD (e.g., 70.00)
        """
        self.db_path = db_path
        self.global_cap_usd = global_cap_usd
        self._lock = threading.Lock()
        
        # Initialize database
        self._init_db()
    
    def _init_db(self):
        """Initialize ledger database schema."""
        with self._get_conn() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS reservations (
                    reservation_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    call_id TEXT NOT NULL UNIQUE,
                    model_id TEXT NOT NULL,
                    provider TEXT NOT NULL,
                    reserved_usd REAL NOT NULL,
                    created_at TEXT NOT NULL,
                    reconciled INTEGER DEFAULT 0
                )
            """)
            
            conn.execute("""
                CREATE TABLE IF NOT EXISTS calls (
                    call_id TEXT PRIMARY KEY,
                    timestamp TEXT NOT NULL,
                    model_id TEXT NOT NULL,
                    model_version TEXT,
                    provider TEXT NOT NULL,
                    prompt_tokens INTEGER NOT NULL,
                    completion_tokens INTEGER NOT NULL,
                    total_tokens INTEGER NOT NULL,
                    actual_cost_usd REAL NOT NULL,
                    duration_ms INTEGER,
                    experiment TEXT NOT NULL,
                    metadata TEXT,
                    error TEXT,
                    finish_reason TEXT,
                    mock_data INTEGER DEFAULT 0
                )
            """)
            
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_calls_experiment 
                ON calls(experiment)
            """)
            
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_calls_provider 
                ON calls(provider)
            """)
            
            conn.commit()
    
    @contextmanager
    def _get_conn(self):
        """Get database connection context."""
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()
    
    def get_status(self) -> BudgetStatus:
        """
        Get current budget status.
        
        Returns:
            BudgetStatus with global and per-provider spending
        """
        with self._lock, self._get_conn() as conn:
            # Get reserved (not yet reconciled)
            reserved_row = conn.execute("""
                SELECT COALESCE(SUM(reserved_usd), 0) as total
                FROM reservations
                WHERE reconciled = 0
            """).fetchone()
            global_reserved = reserved_row['total']
            
            # Get spent (actual costs from completed calls)
            spent_row = conn.execute("""
                SELECT COALESCE(SUM(actual_cost_usd), 0) as total
                FROM calls
            """).fetchone()
            global_spent = spent_row['total']
            
            # Per-provider breakdown
            by_provider = {}
            provider_rows = conn.execute("""
                SELECT 
                    r.provider,
                    COALESCE(SUM(CASE WHEN c.call_id IS NULL THEN r.reserved_usd ELSE 0 END), 0) as reserved,
                    COALESCE(SUM(c.actual_cost_usd), 0) as spent
                FROM reservations r
                LEFT JOIN calls c ON r.call_id = c.call_id
                GROUP BY r.provider
            """).fetchall()
            
            for row in provider_rows:
                by_provider[row['provider']] = {
                    'reserved_usd': row['reserved'],
                    'spent_usd': row['spent'],
                    'total_usd': row['reserved'] + row['spent']
                }
            
            global_available = self.global_cap_usd - global_reserved - global_spent
            
            return BudgetStatus(
                global_cap_usd=self.global_cap_usd,
                global_reserved_usd=global_reserved,
                global_spent_usd=global_spent,
                global_available_usd=global_available,
                by_provider=by_provider
            )
    
    def reserve(self, call_id: str, model_id: str, provider: Provider, 
                worst_case_usd: float) -> Reservation:
        """
        Atomically reserve budget for a call.
        
        Args:
            call_id: Unique identifier for this call
            model_id: Model being called
            provider: Provider (anthropic, groq, openrouter)
            worst_case_usd: Worst-case cost estimate
        
        Returns:
            Reservation object
        
        Raises:
            BudgetExceededError: If reservation would exceed global cap
            ValueError: If call_id already exists
        """
        with self._lock, self._get_conn() as conn:
            # Check if call_id already used (idempotency)
            existing = conn.execute(
                "SELECT call_id FROM calls WHERE call_id = ?",
                (call_id,)
            ).fetchone()
            
            if existing:
                raise ValueError(f"Call {call_id} already recorded (duplicate)")
            
            # Check if already reserved
            existing_res = conn.execute(
                "SELECT reservation_id FROM reservations WHERE call_id = ?",
                (call_id,)
            ).fetchone()
            
            if existing_res:
                raise ValueError(f"Call {call_id} already reserved")
            
            # Check budget (inline to avoid lock re-entry)
            reserved_row = conn.execute("""
                SELECT COALESCE(SUM(reserved_usd), 0) as total
                FROM reservations
                WHERE reconciled = 0
            """).fetchone()
            global_reserved = reserved_row['total']
            
            spent_row = conn.execute("""
                SELECT COALESCE(SUM(actual_cost_usd), 0) as total
                FROM calls
            """).fetchone()
            global_spent = spent_row['total']
            
            global_available = self.global_cap_usd - global_reserved - global_spent
            
            if global_available < worst_case_usd:
                raise BudgetExceededError(
                    f"Reservation would exceed budget cap: "
                    f"available ${global_available:.4f}, "
                    f"requested ${worst_case_usd:.4f}, "
                    f"cap ${self.global_cap_usd:.2f}"
                )
            
            # Create reservation
            cursor = conn.execute(
                """
                INSERT INTO reservations 
                (call_id, model_id, provider, reserved_usd, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    call_id,
                    model_id,
                    provider.value,
                    worst_case_usd,
                    datetime.utcnow().isoformat()
                )
            )
            
            conn.commit()
            
            return Reservation(
                reservation_id=cursor.lastrowid,
                call_id=call_id,
                model_id=model_id,
                provider=provider.value,
                reserved_usd=worst_case_usd,
                created_at=datetime.utcnow().isoformat()
            )
    
    def reconcile(
        self,
        call_id: str,
        model_version: Optional[str],
        prompt_tokens: int,
        completion_tokens: int,
        actual_cost_usd: float,
        duration_ms: int,
        experiment: str,
        metadata: Optional[str] = None,
        error: Optional[str] = None,
        finish_reason: Optional[str] = None
    ):
        """
        Reconcile reservation with actual usage.
        
        Args:
            call_id: Call identifier (must match reservation)
            model_version: Actual model version used
            prompt_tokens: Actual prompt tokens
            completion_tokens: Actual completion tokens
            actual_cost_usd: Actual cost charged by provider
            duration_ms: Call duration in milliseconds
            experiment: Experiment name (quiz, swarm)
            metadata: Optional JSON metadata
        """
        with self._lock, self._get_conn() as conn:
            # Verify reservation exists
            res = conn.execute(
                "SELECT * FROM reservations WHERE call_id = ? AND reconciled = 0",
                (call_id,)
            ).fetchone()
            
            if not res:
                raise ValueError(f"No unreconciled reservation for call {call_id}")
            
            # Record call (with optional error for failed calls)
            conn.execute(
                """
                INSERT INTO calls
                (call_id, timestamp, model_id, model_version, provider,
                 prompt_tokens, completion_tokens, total_tokens,
                 actual_cost_usd, duration_ms, experiment, metadata, error, finish_reason)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    call_id,
                    datetime.utcnow().isoformat(),
                    res['model_id'],
                    model_version or 'unknown',
                    res['provider'],
                    prompt_tokens,
                    completion_tokens,
                    prompt_tokens + completion_tokens,
                    actual_cost_usd,
                    duration_ms,
                    experiment,
                    metadata,
                    error,
                    finish_reason
                )
            )
            
            # Mark reservation as reconciled
            conn.execute(
                "UPDATE reservations SET reconciled = 1 WHERE call_id = ?",
                (call_id,)
            )
            
            conn.commit()
    
    def get_experiment_cost(self, experiment: str) -> float:
        """Get total spent for an experiment."""
        with self._get_conn() as conn:
            row = conn.execute(
                "SELECT COALESCE(SUM(actual_cost_usd), 0) as total FROM calls WHERE experiment = ?",
                (experiment,)
            ).fetchone()
            return row['total']
    
    def check_call_exists(self, call_id: str) -> bool:
        """Check if a call has already been recorded (for idempotency)."""
        with self._get_conn() as conn:
            row = conn.execute(
                "SELECT 1 FROM calls WHERE call_id = ?",
                (call_id,)
            ).fetchone()
            return row is not None


class BudgetExceededError(Exception):
    """Raised when a reservation would exceed the budget cap."""
    pass
