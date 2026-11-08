"""Test recovery tool roundtrip with production journal writer."""

import json
import sqlite3
import tempfile
from pathlib import Path

import pytest

from lib.budget import BudgetTracker
from lib.journal import JournalEntry, ResponseJournal
from lib.models import Provider
from tools.recover_from_journal import rebuild_manifest_from_ledger


def test_recovery_roundtrip_with_real_journals():
    """
    Test full roundtrip: write journals with production format, recover them.
    
    Verifies:
    - Recovered count > 0
    - All canonical fields match
    - Full model IDs preserved
    - option_order preserved
    - Sample indices correct
    """
    with tempfile.TemporaryDirectory() as tmpdir:
        tmppath = Path(tmpdir)
        ledger_path = tmppath / "ledger.db"
        journal_dir = tmppath / "journal"
        journal_dir.mkdir()
        
        # Initialize budget tracker
        budget = BudgetTracker(ledger_path, 100.0)
        journal = ResponseJournal(journal_dir)
        
        # Define test scenarios (real quiz structure)
        run_id = "quiz_v4_main_n20_20261108"
        scenarios = [
            {
                "scenario_id": "trolley_basic",
                "option_order": ["leave_alone", "pull_switch"],
                "model_id": "anthropic/claude-haiku-5-5",
                "responses": [
                    ("I choose to pull the switch. **B**", "B", "pull_switch"),
                    ("I will leave it alone. **A**", "A", "leave_alone")
                ]
            },
            {
                "scenario_id": "trolley_loop",
                "option_order": ["pull_switch", "leave_alone"],
                "model_id": "openrouter/google/gemini-3.8-flash",
                "responses": [
                    ("After analysis, **A)** pull the switch", "A", "pull_switch"),
                    ("I refuse to make this choice", None, None)
                ]
            }
        ]
        
        expected_results = []
        
        for scenario in scenarios:
            for sample_idx, (response_text, expected_letter, expected_semantic) in enumerate(scenario["responses"]):
                call_id = f"{run_id}_{scenario['scenario_id']}_{scenario['model_id'].replace('/', '_')}_s{sample_idx}"
                
                # Reserve budget
                provider = Provider.ANTHROPIC if 'anthropic' in scenario['model_id'] else Provider.OPENROUTER
                budget.reserve(
                    call_id=call_id,
                    model_id=scenario['model_id'],
                    provider=provider,
                    worst_case_usd=0.01
                )
                
                # Write journal (PRODUCTION format)
                journal_entry = JournalEntry(
                    call_id=call_id,
                    timestamp="2026-11-08T20:00:00Z",
                    model_id=scenario['model_id'],  # Top-level full ID
                    model_version="test-v1",
                    provider='anthropic' if 'anthropic' in scenario['model_id'] else 'openrouter',
                    experiment="quiz",
                    usage={"prompt_tokens": 100, "completion_tokens": 50, "total_tokens": 150},
                    actual_cost_usd=0.001234,
                    duration_ms=500,
                    finish_reason="stop",
                    content_hash="abc123",
                    raw_response={
                        "content": response_text,  # Simple format for test
                        "usage": {"total_tokens": 150}
                    },
                    metadata=json.dumps({
                        "scenario_id": scenario['scenario_id'],
                        "option_order": scenario['option_order']
                    }),
                    error=None
                )
                journal.write(journal_entry)
                
                # Reconcile to ledger
                budget.reconcile(
                    call_id=call_id,
                    model_version="test-v1",
                    prompt_tokens=100,
                    completion_tokens=50,
                    actual_cost_usd=0.001234,
                    duration_ms=500,
                    experiment="quiz",
                    finish_reason="stop"
                )
                
                expected_results.append({
                    "call_id": call_id,
                    "question_id": scenario['scenario_id'],
                    "model_id": scenario['model_id'],
                    "sample_idx": sample_idx,
                    "option_order": scenario['option_order'],
                    "display_letter": expected_letter,
                    "semantic_choice": expected_semantic
                })
        
        # Now recover from journals
        manifest = rebuild_manifest_from_ledger(
            ledger_path=ledger_path,
            experiment="quiz",
            output_path=tmppath / "recovered.json",
            run_id=run_id,
            journal_dir=journal_dir
        )
        
        # Verify recovery
        assert manifest is not None
        results = manifest.get("results", [])
        
        # Assert recovered count > 0
        assert len(results) > 0, "Recovery returned zero results"
        assert len(results) == len(expected_results), f"Expected {len(expected_results)} results, got {len(results)}"
        
        # Verify all fields match
        results_by_id = {r['call_id']: r for r in results}
        
        for expected in expected_results:
            call_id = expected['call_id']
            assert call_id in results_by_id, f"Missing call_id: {call_id}"
            
            actual = results_by_id[call_id]
            
            # Verify canonical fields
            assert actual['question_id'] == expected['question_id'], \
                f"{call_id}: question_id mismatch"
            
            assert actual['model_id'] == expected['model_id'], \
                f"{call_id}: model_id mismatch (got '{actual['model_id']}')"
            
            assert actual['sample_idx'] == expected['sample_idx'], \
                f"{call_id}: sample_idx mismatch"
            
            assert actual['option_order'] == expected['option_order'], \
                f"{call_id}: option_order mismatch"
            
            assert actual['display_letter'] == expected['display_letter'], \
                f"{call_id}: display_letter mismatch (got '{actual['display_letter']}')"
            
            assert actual['semantic_choice'] == expected['semantic_choice'], \
                f"{call_id}: semantic_choice mismatch (got '{actual['semantic_choice']}')"
        
        print(f"\n✓ Roundtrip test passed:")
        print(f"  Wrote {len(expected_results)} journals with production format")
        print(f"  Recovered {len(results)} results")
        print(f"  All canonical fields match (question_id, model_id, option_order, semantic_choice)")


def test_recovery_exits_on_all_skipped():
    """Test that recovery exits with error if all calls skipped."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmppath = Path(tmpdir)
        ledger_path = tmppath / "ledger.db"
        journal_dir = tmppath / "journal"
        journal_dir.mkdir()
        
        # Initialize budget tracker
        budget = BudgetTracker(ledger_path, 100.0)
        
        # Create ledger entry WITHOUT corresponding journal
        call_id = "quiz_test_trolley_haiku_s0"
        budget.reserve(
            call_id=call_id,
            model_id="anthropic/claude-haiku-5-5",
            provider=Provider.ANTHROPIC,
            worst_case_usd=0.01
        )
        budget.reconcile(
            call_id=call_id,
            model_version="test-v1",
            prompt_tokens=100,
            completion_tokens=50,
            actual_cost_usd=0.001,
            duration_ms=500,
            experiment="quiz",
            finish_reason="stop"
        )
        
        # Attempt recovery (should exit with error since no journals exist)
        import sys
        from unittest.mock import patch
        
        with patch.object(sys, 'exit') as mock_exit:
            rebuild_manifest_from_ledger(
                ledger_path=ledger_path,
                experiment="quiz",
                output_path=tmppath / "recovered.json",
                run_id="quiz_test",
                journal_dir=journal_dir
            )
            
            # Should have called sys.exit(1)
            mock_exit.assert_called_once_with(1)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
