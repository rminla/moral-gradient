"""
Durable response journal: write raw responses to disk before reconcile.

Prevents data loss if ledger write fails. Journal entries can be replayed
to recover from storage failures without repeating API calls.
"""

import json
import time
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional


@dataclass
class JournalEntry:
    """Durable journal entry for an API call response."""
    call_id: str
    timestamp: str
    model_id: str
    model_version: str
    provider: str
    experiment: str
    usage: Dict[str, int]
    actual_cost_usd: float
    duration_ms: int
    finish_reason: Optional[str]
    content_hash: str  # SHA256 of content for integrity
    raw_response: Optional[Dict]
    metadata: Optional[str]
    error: Optional[str] = None


class ResponseJournal:
    """
    Write-ahead journal for API responses.
    
    Ensures responses are durably recorded before fragile ledger operations.
    Supports recovery from ledger failures without losing paid API data.
    """
    
    def __init__(self, journal_dir: Path):
        self.journal_dir = Path(journal_dir)
        self.journal_dir.mkdir(parents=True, exist_ok=True)
    
    def write(self, entry: JournalEntry) -> Path:
        """
        Write journal entry atomically.
        
        Returns path to written journal file.
        """
        # Use call_id as filename (safe after sanitization)
        safe_id = entry.call_id.replace('/', '_')
        journal_path = self.journal_dir / f"{safe_id}.journal"
        temp_path = journal_path.with_suffix('.journal.tmp')
        
        # Write to temp file first
        with open(temp_path, 'w') as f:
            json.dump(asdict(entry), f, indent=2)
            f.flush()
        
        # Atomic rename
        temp_path.rename(journal_path)
        
        return journal_path
    
    def read(self, call_id: str) -> Optional[JournalEntry]:
        """Read journal entry by call_id."""
        safe_id = call_id.replace('/', '_')
        journal_path = self.journal_dir / f"{safe_id}.journal"
        
        if not journal_path.exists():
            return None
        
        with open(journal_path) as f:
            data = json.load(f)
        
        return JournalEntry(**data)
    
    def list_unreconciled(self, ledger_call_ids: set) -> list:
        """
        Find journal entries not yet in ledger.
        
        Args:
            ledger_call_ids: Set of call_ids already in ledger
            
        Returns:
            List of JournalEntry for calls not in ledger
        """
        unreconciled = []
        
        for journal_file in self.journal_dir.glob("*.journal"):
            with open(journal_file) as f:
                data = json.load(f)
            
            entry = JournalEntry(**data)
            if entry.call_id not in ledger_call_ids:
                unreconciled.append(entry)
        
        return unreconciled
    
    def recover(self, budget_tracker) -> int:
        """
        Recover unreconciled journal entries to ledger.
        
        Returns number of entries recovered.
        """
        # Get existing call IDs from ledger
        ledger_ids = set()
        with budget_tracker._get_conn() as conn:
            cursor = conn.execute("SELECT call_id FROM calls")
            ledger_ids = {row['call_id'] for row in cursor.fetchall()}
        
        # Find and recover unreconciled entries
        unreconciled = self.list_unreconciled(ledger_ids)
        
        for entry in unreconciled:
            try:
                # Reconcile from journal
                budget_tracker.reconcile(
                    call_id=entry.call_id,
                    model_version=entry.model_version,
                    prompt_tokens=entry.usage['prompt_tokens'],
                    completion_tokens=entry.usage['completion_tokens'],
                    actual_cost_usd=entry.actual_cost_usd,
                    duration_ms=entry.duration_ms,
                    experiment=entry.experiment,
                    metadata=entry.metadata,
                    error=entry.error
                )
            except Exception as e:
                print(f"Warning: Failed to recover {entry.call_id}: {e}")
                continue
        
        return len(unreconciled)


def hash_content(content: str) -> str:
    """Hash content for integrity checking."""
    import hashlib
    return hashlib.sha256(content.encode()).hexdigest()[:16]
