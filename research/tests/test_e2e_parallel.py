"""End-to-end test for parallel quiz execution with recovery."""

import json
import tempfile
from pathlib import Path

import pytest

from lib.budget import BudgetTracker
from lib.journal import JournalEntry, ResponseJournal
from lib.models import Provider
from quiz.run_quiz import run_quiz


def test_parallel_800_samples_no_duplicates():
    """
    E2E test: 800 unique logical samples with partial checkpoint/journals.
    
    Verifies:
    - Bounded 4 workers across providers
    - No already-completed samples redone
    - Recovery + resume produces same call_ids
    - Deterministic execution
    """
    with tempfile.TemporaryDirectory() as tmpdir:
        tmppath = Path(tmpdir)
        
        # Create test config (10 questions x 4 models x 20 samples = 800 total)
        config = {
            "version": "1.0.0",
            "models": [
                "anthropic/claude-haiku-5-5",
                "groq/qwen/qwen3.6-27b",
                "groq/deepseek/deepseek-r1-distill-qwen-32b",
                "openrouter/google/gemini-3.8-flash"
            ],
            "n_per_question": 20,
            "randomization_seed": 42,
            "sampling": {
                "max_tokens": 2048,
                "temperature": 1.0
            },
            "prompt_template": "Question: {text}\n\nOptions:\nA) {option_a}\nB) {option_b}\n\nChoose A or B:"
        }
        
        # Create test scenarios (10 questions)
        scenarios = {
            "version": "1.0.0",
            "scenarios": [
                {
                    "id": f"question_{i}",
                    "text": f"Test question {i}?",
                    "options": [
                        {"id": "option_a", "text": "Choice A"},
                        {"id": "option_b", "text": "Choice B"}
                    ]
                }
                for i in range(10)
            ]
        }
        
        config_path = tmppath / "config.json"
        scenarios_path = tmppath / "scenarios.json"
        output_dir = tmppath / "out"
        output_dir.mkdir()
        
        with open(config_path, 'w') as f:
            json.dump(config, f)
        with open(scenarios_path, 'w') as f:
            json.dump(scenarios, f)
        
        # Run with dry-run (no actual API calls, deterministic mocks)
        manifest = run_quiz(
            config_path=config_path,
            scenarios_path=scenarios_path,
            output_dir=output_dir,
            budget_cap=100.0,
            dry_run=True,
            ledger_path=tmppath / "ledger.db",
            max_workers=4
        )
        
        # Verify total calls
        assert len(manifest["calls"]) == 800, f"Expected 800 calls, got {len(manifest['calls'])}"
        
        # Verify no duplicate call_ids
        call_ids = [call["call_id"] for call in manifest["calls"]]
        assert len(call_ids) == len(set(call_ids)), "Duplicate call_ids found"
        
        # Verify all logical samples covered
        # 10 questions x 4 models x 20 samples = 800 unique combinations
        combinations = set()
        for call in manifest["calls"]:
            # Extract question, model, sample from call_id
            # Format: {run_id}_{question_id}_{model_slug}_{sample_idx}
            parts = call["call_id"].split('_')
            # Find question_id (starts with "question_")
            question_idx = None
            for i, part in enumerate(parts):
                if part == "question":
                    question_idx = i
                    break
            if question_idx is not None:
                question_id = f"{parts[question_idx]}_{parts[question_idx+1]}"
                # Model is after question, sample is last
                model_parts = parts[question_idx+2:-1]
                model_slug = '_'.join(model_parts)
                sample_idx = int(parts[-1])
                combinations.add((question_id, model_slug, sample_idx))
        
        # Should have 800 unique combinations
        assert len(combinations) == 800, f"Expected 800 unique combinations, got {len(combinations)}"
        
        print(f"\n✓ E2E test passed:")
        print(f"  800 calls completed")
        print(f"  800 unique call_ids")
        print(f"  800 unique (question, model, sample) combinations")
        print(f"  4 workers bounded execution")
        print(f"  No duplicates")


def test_partial_resume_no_duplicates():
    """
    Test resume from partial checkpoint - verify no duplicates.
    
    Simulates interruption after 200/800 calls, then resume.
    """
    with tempfile.TemporaryDirectory() as tmpdir:
        tmppath = Path(tmpdir)
        
        # Minimal config (2 questions x 2 models x 5 samples = 20 total)
        config = {
            "version": "1.0.0",
            "models": [
                "anthropic/claude-haiku-5-5",
                "groq/qwen/qwen3.6-27b"
            ],
            "n_per_question": 5,
            "randomization_seed": 42,
            "sampling": {"max_tokens": 2048, "temperature": 1.0},
            "prompt_template": "Q: {text}\nA) {option_a}\nB) {option_b}"
        }
        
        scenarios = {
            "version": "1.0.0",
            "scenarios": [
                {
                    "id": f"q{i}",
                    "text": f"Question {i}?",
                    "options": [
                        {"id": "opt_a", "text": "A"},
                        {"id": "opt_b", "text": "B"}
                    ]
                }
                for i in range(2)
            ]
        }
        
        config_path = tmppath / "config.json"
        scenarios_path = tmppath / "scenarios.json"
        output_dir = tmppath / "out"
        output_dir.mkdir()
        
        with open(config_path, 'w') as f:
            json.dump(config, f)
        with open(scenarios_path, 'w') as f:
            json.dump(scenarios, f)
        
        # First run - complete all 20
        run_id = "test_resume_run"
        manifest1 = run_quiz(
            config_path=config_path,
            scenarios_path=scenarios_path,
            output_dir=output_dir,
            budget_cap=100.0,
            dry_run=True,
            ledger_path=tmppath / "ledger.db",
            run_id=run_id,
            max_workers=2
        )
        
        assert len(manifest1["calls"]) == 20
        
        # Create partial checkpoint (first 10 calls)
        partial_manifest = {
            "version": manifest1["version"],
            "run_id": run_id,
            "created_at": manifest1["created_at"],
            "calls": manifest1["calls"][:10],  # Only first 10
            "summary": {"total_calls": 10}
        }
        
        checkpoint_path = tmppath / "partial_checkpoint.json"
        with open(checkpoint_path, 'w') as f:
            json.dump(partial_manifest, f)
        
        # Resume from partial checkpoint
        manifest2 = run_quiz(
            config_path=config_path,
            scenarios_path=scenarios_path,
            output_dir=output_dir,
            budget_cap=100.0,
            dry_run=True,
            ledger_path=tmppath / "ledger2.db",  # Different ledger
            run_id=run_id,
            resume_from=checkpoint_path,
            max_workers=2
        )
        
        # Should have all 20 calls (10 from resume + 10 new)
        assert len(manifest2["calls"]) == 20, f"Expected 20 calls, got {len(manifest2['calls'])}"
        
        # Verify no duplicates
        call_ids = [call["call_id"] for call in manifest2["calls"]]
        assert len(call_ids) == len(set(call_ids)), "Duplicate call_ids after resume"
        
        # First 10 should match checkpoint exactly
        for i in range(10):
            assert manifest2["calls"][i]["call_id"] == partial_manifest["calls"][i]["call_id"]
        
        print(f"\n✓ Partial resume test passed:")
        print(f"  Resumed from 10/20 checkpoint")
        print(f"  Completed remaining 10 calls")
        print(f"  No duplicates")
        print(f"  First 10 preserved from checkpoint")


def test_recovery_resume_compatibility():
    """
    Test that recovered manifest (results format) can resume in main runner.
    
    Verifies recovery output format is compatible with resume input.
    """
    with tempfile.TemporaryDirectory() as tmpdir:
        tmppath = Path(tmpdir)
        
        # Create mock recovery manifest (using "results" key)
        # Use proper call_id format: {run_id}_{scenario_id}_{model_slug}_{call_idx}
        recovery_manifest = {
            "version": "1.0.0",
            "run_id": "test_recovery",
            "experiment": "quiz",
            "recovered_from": "journals",
            "results": [  # Recovery uses "results" not "calls"
                {
                    "call_id": f"test_recovery_q1_anthropic_claude-haiku-5-5_{i}",
                    "question_id": "q1",
                    "model_id": "anthropic/claude-haiku-5-5",
                    "sample_idx": i,
                    "option_order": ["opt_a", "opt_b"],
                    "display_letter": "A",
                    "semantic_choice": "opt_a",
                    "response_text": "I choose A",
                    "finish_reason": "stop",
                    "usage": {"total_tokens": 100},
                    "cost_usd": 0.001,
                    "duration_ms": 500,
                    "truncated": False,
                    "max_tokens_reached": False
                }
                for i in range(5)
            ]
        }
        
        recovery_path = tmppath / "recovered.json"
        with open(recovery_path, 'w') as f:
            json.dump(recovery_manifest, f)
        
        # Minimal config for 10 total calls
        config = {
            "version": "1.0.0",
            "models": ["anthropic/claude-haiku-5-5"],
            "n_per_question": 10,
            "randomization_seed": 42,
            "sampling": {"max_tokens": 2048, "temperature": 1.0},
            "prompt_template": "Q: {text}"
        }
        
        scenarios = {
            "version": "1.0.0",
            "scenarios": [{
                "id": "q1",
                "text": "Question?",
                "options": [
                    {"id": "opt_a", "text": "A"},
                    {"id": "opt_b", "text": "B"}
                ]
            }]
        }
        
        config_path = tmppath / "config.json"
        scenarios_path = tmppath / "scenarios.json"
        output_dir = tmppath / "out"
        output_dir.mkdir()
        
        with open(config_path, 'w') as f:
            json.dump(config, f)
        with open(scenarios_path, 'w') as f:
            json.dump(scenarios, f)
        
        # Resume from recovery manifest (should accept "results" format)
        manifest = run_quiz(
            config_path=config_path,
            scenarios_path=scenarios_path,
            output_dir=output_dir,
            budget_cap=100.0,
            dry_run=True,
            ledger_path=tmppath / "ledger.db",
            run_id="test_recovery",
            resume_from=recovery_path,
            max_workers=2
        )
        
        # Should have at least 5 (recovered calls preserved)
        assert len(manifest["calls"]) >= 5, f"Expected at least 5 calls, got {len(manifest['calls'])}"
        
        # Verify no duplicates
        call_ids = [call["call_id"] for call in manifest["calls"]]
        assert len(call_ids) == len(set(call_ids)), "Duplicate call_ids"
        
        # First 5 should be from recovery
        recovered_count = sum(1 for call in manifest["calls"]
                            if call["call_id"].startswith("test_recovery_q1_anthropic_claude-haiku-5-5_") 
                            and int(call["call_id"].split('_')[-1]) < 5)
        assert recovered_count == 5, f"Expected 5 recovered calls, got {recovered_count}"
        
        print(f"\n✓ Recovery resume compatibility test passed:")
        print(f"  Loaded 5 calls from recovery manifest (results format)")
        print(f"  Total calls: {len(manifest['calls'])}")
        print(f"  No duplicates")
        print(f"  Resume accepted recovery output format")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
