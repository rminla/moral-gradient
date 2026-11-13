#!/usr/bin/env python3
"""Global ledger SQLite management for preregistered studies.

Implements deviation-4: SQLite-based global ledger with:
- Pre-flight checks against $70 cap
- Reservation before calls
- Insert and reconciliation after calls
- Stage cap enforcement
- Summary generation
- Automatic backup

Schema matches global-ledger-schema.sql.
"""
import json
import shutil
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional


class BudgetExceeded(Exception):
    """Raised when budget would be exceeded."""
    pass


class GlobalLedger:
    """Global ledger for tracking research spend across all studies."""
    
    GLOBAL_CAP = 70.0  # $70 hard cap
    
    # Schema for global ledger
    SCHEMA = """
    CREATE TABLE IF NOT EXISTS reservations (
        reservation_id INTEGER PRIMARY KEY AUTOINCREMENT,
        call_id TEXT NOT NULL UNIQUE,
        model_id TEXT NOT NULL,
        provider TEXT NOT NULL,
        reserved_usd REAL NOT NULL,
        created_at TEXT NOT NULL,
        reconciled INTEGER DEFAULT 0
    );
    
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
        mock_data INTEGER DEFAULT 0,
        error TEXT,
        finish_reason TEXT
    );
    
    CREATE INDEX IF NOT EXISTS idx_calls_experiment ON calls(experiment);
    CREATE INDEX IF NOT EXISTS idx_calls_provider ON calls(provider);
    """
    
    def __init__(self, db_path: Path, experiment: str, stage_cap_usd: float, allow_create: bool = False):
        """Initialize global ledger.
        
        Args:
            db_path: Path to SQLite database
            experiment: Experiment name (iteration name)
            stage_cap_usd: Hard cap for this stage (e.g. $2.97 for S1 canary)
            allow_create: If False, refuse when file is missing (Fix #8)
        """
        self.db_path = Path(db_path)
        self.experiment = experiment
        self.stage_cap_usd = float(stage_cap_usd)
        self.backed_up = False
        
        # Fix #8: Refuse when file is missing unless explicitly allowed
        if not self.db_path.exists():
            if not allow_create:
                raise FileNotFoundError(
                    f"Global ledger not found: {self.db_path}\n"
                    f"The ledger file must exist before running. Never auto-create in production."
                )
            self._initialize_db()
        
        # Verify schema
        self._ensure_schema()
    
    def _initialize_db(self):
        """Initialize database with schema."""
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(str(self.db_path))
        conn.executescript(self.SCHEMA)
        conn.commit()
        conn.close()
    
    def _ensure_schema(self):
        """Ensure schema exists (for existing DBs)."""
        conn = sqlite3.connect(str(self.db_path))
        conn.executescript(self.SCHEMA)
        conn.commit()
        conn.close()
    
    def backup(self):
        """Back up database before first insert."""
        if self.backed_up:
            return
        
        backup_path = self.db_path.with_suffix(
            f".backup-{datetime.now().strftime('%Y%m%d-%H%M%S')}.db"
        )
        shutil.copy2(self.db_path, backup_path)
        self.backed_up = True
        print(f"✓ Backed up ledger to {backup_path}")
    
    def get_committed_spend(self) -> float:
        """Calculate committed spend.
        
        Committed = SUM(calls.actual_cost_usd) + SUM(reservations.reserved_usd WHERE reconciled=0)
        """
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        # Sum of actual calls
        cursor.execute("SELECT COALESCE(SUM(actual_cost_usd), 0) FROM calls")
        calls_sum = cursor.fetchone()[0]
        
        # Sum of unreconciled reservations
        cursor.execute("SELECT COALESCE(SUM(reserved_usd), 0) FROM reservations WHERE reconciled = 0")
        reserved_sum = cursor.fetchone()[0]
        
        conn.close()
        
        return calls_sum + reserved_sum
    
    def get_stage_spend(self) -> float:
        """Get spend for current stage (experiment)."""
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        cursor.execute(
            "SELECT COALESCE(SUM(actual_cost_usd), 0) FROM calls WHERE experiment = ?",
            (self.experiment,)
        )
        stage_sum = cursor.fetchone()[0]
        
        conn.close()
        return stage_sum
    
    def pre_flight_check(self):
        """Pre-flight check: refuse if committed + stage cap > $70."""
        committed = self.get_committed_spend()
        
        if committed + self.stage_cap_usd > self.GLOBAL_CAP:
            raise BudgetExceeded(
                f"Pre-flight FAILED: committed ${committed:.2f} + stage cap ${self.stage_cap_usd:.2f} "
                f"= ${committed + self.stage_cap_usd:.2f} > ${self.GLOBAL_CAP:.2f} global cap"
            )
        
        print(f"✓ Pre-flight passed: ${committed:.2f} committed + ${self.stage_cap_usd:.2f} stage cap "
              f"= ${committed + self.stage_cap_usd:.2f} <= ${self.GLOBAL_CAP:.2f}")
    
    def reserve(self, call_id: str, model_id: str, provider: str, estimated_usd: float):
        """Reserve budget before making a call.
        
        Args:
            call_id: Unique call identifier
            model_id: Model name
            provider: Provider name
            estimated_usd: Estimated cost
        
        Raises:
            BudgetExceeded: If reservation would exceed stage cap
        """
        # Check stage cap
        stage_spend = self.get_stage_spend()
        committed = self.get_committed_spend()
        
        # Check against global cap
        if committed + estimated_usd > self.GLOBAL_CAP:
            raise BudgetExceeded(
                f"BUDGET STOP: global committed ${committed:.2f} + ${estimated_usd:.4f} "
                f"> ${self.GLOBAL_CAP:.2f} cap"
            )
        
        # Check against stage cap
        if stage_spend + estimated_usd > self.stage_cap_usd:
            raise BudgetExceeded(
                f"BUDGET STOP: stage spend ${stage_spend:.2f} + ${estimated_usd:.4f} "
                f"> ${self.stage_cap_usd:.2f} stage cap"
            )
        
        # Back up before first insert
        self.backup()
        
        # Insert reservation
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        try:
            cursor.execute(
                """INSERT INTO reservations 
                   (call_id, model_id, provider, reserved_usd, created_at, reconciled)
                   VALUES (?, ?, ?, ?, ?, 0)""",
                (call_id, model_id, provider, estimated_usd, datetime.now().isoformat())
            )
            conn.commit()
        except sqlite3.IntegrityError:
            # Call ID already exists
            conn.rollback()
        finally:
            conn.close()
    
    def insert_call(
        self,
        call_id: str,
        model_id: str,
        provider: str,
        actual_cost_usd: float,
        prompt_tokens: int = 0,
        completion_tokens: int = 0,
        duration_ms: Optional[int] = None,
        model_version: Optional[str] = None,
        metadata: Optional[str] = None,
        mock_data: int = 0,
        error: Optional[str] = None,
        finish_reason: Optional[str] = None,
    ):
        """Insert call record and reconcile reservation.
        
        Args:
            call_id: Unique call identifier
            model_id: Model name
            provider: Provider name
            actual_cost_usd: Actual cost incurred
            prompt_tokens: Number of prompt tokens
            completion_tokens: Number of completion tokens
            duration_ms: Duration in milliseconds
            model_version: Model version
            metadata: JSON metadata
            mock_data: 1 if mock data, 0 if real
            error: Error message if any
            finish_reason: Finish reason
        """
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        try:
            # Insert call
            cursor.execute(
                """INSERT OR REPLACE INTO calls 
                   (call_id, timestamp, model_id, model_version, provider, 
                    prompt_tokens, completion_tokens, total_tokens, actual_cost_usd,
                    duration_ms, experiment, metadata, mock_data, error, finish_reason)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    call_id,
                    datetime.now().isoformat(),
                    model_id,
                    model_version,
                    provider,
                    prompt_tokens,
                    completion_tokens,
                    prompt_tokens + completion_tokens,
                    actual_cost_usd,
                    duration_ms,
                    self.experiment,
                    metadata,
                    mock_data,
                    error,
                    finish_reason,
                )
            )
            
            # Reconcile reservation
            cursor.execute(
                "UPDATE reservations SET reconciled = 1 WHERE call_id = ?",
                (call_id,)
            )
            
            conn.commit()
        finally:
            conn.close()
    
    def generate_summary(self, output_path: Optional[Path] = None) -> Dict:
        """Generate global-ledger-update.json summary.
        
        Returns:
            Dict with before/after stats matching the example format
        """
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        # Current experiment stats
        cursor.execute(
            "SELECT COUNT(*), COALESCE(SUM(actual_cost_usd), 0) FROM calls WHERE experiment = ?",
            (self.experiment,)
        )
        exp_n, exp_sum = cursor.fetchone()
        
        # Global stats
        cursor.execute("SELECT COUNT(*), COALESCE(SUM(actual_cost_usd), 0) FROM calls")
        total_n, total_spent = cursor.fetchone()
        
        cursor.execute("SELECT COUNT(*), COALESCE(SUM(reserved_usd), 0) FROM reservations WHERE reconciled = 0")
        open_holds_n, open_holds_usd = cursor.fetchone()
        
        conn.close()
        
        committed = total_spent + open_holds_usd
        remaining = self.GLOBAL_CAP - committed
        
        summary = {
            "ok": True,
            "ts_local": datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
            "experiment": self.experiment,
            "harness_calls": exp_n,
            "harness_sum": exp_sum,
            "inserted": exp_n,
            "skipped": 0,
            "sum_actual_inserted": exp_sum,
            "after": {
                "spent": total_spent,
                "n": total_n,
                "open_holds_n": open_holds_n,
                "open_holds_usd": open_holds_usd,
                "committed": committed,
                "global_remaining_70": remaining,
            }
        }
        
        if output_path:
            output_path.write_text(json.dumps(summary, indent=2))
            print(f"✓ Wrote summary to {output_path}")
        
        return summary
