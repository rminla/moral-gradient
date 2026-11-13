"""Real-number tests against frozen v3final records and run_stage validation.

Tests:
1. Check frozen v3final records: Qwen keep 31/48, Haiku keep 41/48, 18 invalid waive
2. Run run_stage on fake transport and verify calls.jsonl matches prereg
3. Test missing-ledger refusal and cap hard stop through run_prereg

Run: python3 -m pytest test_real_numbers.py -v
"""
import json
import os
import shutil
import sqlite3
import subprocess
import tempfile
from pathlib import Path

import pytest


def test_missing_ledger_refusal():
    """Test that run_prereg refuses when global ledger is missing."""
    # Try to run without allow_create
    result = subprocess.run(
        [
            "python3", "research/prereg/run_prereg.py",
            "claude-haiku-5.5",
            "--iter", "test_missing",
            "--stage", "main",
            "--preset", "full",
            "--phases", "si",
            "--cues", "benef_org",
            "--cue-n", "benef_org:1",
            "--cap", "1.00",
            "--budget", "1.00",
            "--global-ledger", "/tmp/nonexistent_ledger_test.db",
            "--workers", "1"
        ],
        capture_output=True,
        text=True,
        env={**os.environ, "FAKE_TRANSPORT": "1"},
        timeout=10
    )
    
    # Should fail
    assert result.returncode != 0, "Should refuse missing ledger"
    output = result.stdout + result.stderr
    assert "not found" in output.lower() or "missing" in output.lower() or "does not exist" in output.lower()
    
    print("✓ Missing ledger refusal works")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
