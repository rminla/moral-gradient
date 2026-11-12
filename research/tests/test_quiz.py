"""Tests for quiz harness in dry-run mode."""

import json
import tempfile
from pathlib import Path

import pytest

import sys
sys.path.insert(0, str(Path(__file__).parent.parent / "quiz"))

import run_quiz


def test_quiz_dry_run():
    """Test full quiz run in dry-run mode."""
    with tempfile.TemporaryDirectory() as tmpdir:
        output_dir = Path(tmpdir)
        
        # Run with very limited config for fast test
        config_path = Path(__file__).parent.parent / "quiz" / "config.json"
        scenarios_path = Path(__file__).parent.parent / "quiz" / "scenarios.json"
        
        # Load and modify config for test (just 1 model, 1 scenario, n=2)
        with open(config_path) as f:
            config = json.load(f)
        
        test_config_path = Path(tmpdir) / "test_config.json"
        test_config = {
            **config,
            "models": ["anthropic/claude-haiku-5-5"],  # Just one model
            "n_per_question": 2  # Just 2 samples
        }
        
        with open(test_config_path, 'w') as f:
            json.dump(test_config, f)
        
        # Load and modify scenarios (just 1 scenario)
        with open(scenarios_path) as f:
            scenarios = json.load(f)
        
        test_scenarios_path = Path(tmpdir) / "test_scenarios.json"
        test_scenarios = {
            **scenarios,
            "scenarios": [scenarios["scenarios"][0]]  # Just trolley
        }
        
        with open(test_scenarios_path, 'w') as f:
            json.dump(test_scenarios, f)
        
        # Run quiz in dry-run mode (with temp ledger)
        ledger_path = Path(tmpdir) / "test_ledger.db"
        manifest = run_quiz.run_quiz(
            config_path=test_config_path,
            scenarios_path=test_scenarios_path,
            output_dir=output_dir,
            budget_cap=1.0,
            dry_run=True,
            ledger_path=ledger_path
        )
        
        # Verify manifest structure
        assert manifest["version"] == "1.0.0"
        assert manifest["dry_run"] is True
        assert len(manifest["calls"]) == 2  # 1 model × 1 scenario × 2 samples
        
        # Check all calls completed
        for call in manifest["calls"]:
            assert "call_id" in call
            assert "model_id" in call
            assert "scenario_id" in call
            assert "response_parsed" in call
            assert call["response_parsed"]["valid"] in [True, False]


def test_prompt_generation():
    """Test prompt generation with option order."""
    scenarios_path = Path(__file__).parent.parent / "quiz" / "scenarios.json"
    with open(scenarios_path) as f:
        scenarios = json.load(f)
    
    scenario = scenarios["scenarios"][0]  # trolley
    template = "Scenario: {scenario_text}\n\nA) {option_a}\nB) {option_b}"
    
    # Original order
    option_ids = [opt["id"] for opt in scenario["options"]]
    prompt1 = run_quiz.generate_prompt(scenario, option_ids, template)
    
    # Swapped order
    prompt2 = run_quiz.generate_prompt(scenario, option_ids[::-1], template)
    
    # Should be different (options swapped)
    assert prompt1 != prompt2
    assert "Pull the switch" in prompt1
    assert "Leave the switch alone" in prompt1


def test_response_parsing():
    """Test parsing model responses."""
    # Test valid responses
    assert run_quiz.parse_response("A) I would pull the switch") == "A"
    assert run_quiz.parse_response("B\nHere is my reasoning...") == "B"
    assert run_quiz.parse_response("I choose A because...") == "A"
    
    # Test invalid responses
    assert run_quiz.parse_response("I refuse to answer") is None
    assert run_quiz.parse_response("Both options are problematic") is None


def test_semantic_mapping():
    """Test mapping letter choices to semantic IDs."""
    option_order = ["pull_switch", "leave_alone"]
    
    assert run_quiz.map_choice_to_semantic("A", option_order) == "pull_switch"
    assert run_quiz.map_choice_to_semantic("B", option_order) == "leave_alone"
    assert run_quiz.map_choice_to_semantic(None, option_order) is None
    
    # Swapped order
    swapped_order = option_order[::-1]
    assert run_quiz.map_choice_to_semantic("A", swapped_order) == "leave_alone"
    assert run_quiz.map_choice_to_semantic("B", swapped_order) == "pull_switch"


def test_checkpoint_resume():
    """Test checkpoint and resume functionality."""
    with tempfile.TemporaryDirectory() as tmpdir:
        output_dir = Path(tmpdir)
        
        config_path = Path(__file__).parent.parent / "quiz" / "config.json"
        scenarios_path = Path(__file__).parent.parent / "quiz" / "scenarios.json"
        
        # Load and modify config for test
        with open(config_path) as f:
            config = json.load(f)
        
        test_config_path = Path(tmpdir) / "test_config.json"
        test_config = {
            **config,
            "models": ["anthropic/claude-haiku-5-5"],
            "n_per_question": 2
        }
        
        with open(test_config_path, 'w') as f:
            json.dump(test_config, f)
        
        # First run (will create checkpoint, with temp ledger)
        ledger_path = Path(tmpdir) / "test_ledger.db"
        manifest1 = run_quiz.run_quiz(
            config_path=test_config_path,
            scenarios_path=scenarios_path,
            output_dir=output_dir,
            budget_cap=1.0,
            dry_run=True,
            ledger_path=ledger_path
        )
        
        # Save manifest
        manifest_path = output_dir / "checkpoint.json"
        with open(manifest_path, 'w') as f:
            json.dump(manifest1, f)
        
        # Resume (should skip already completed calls, same temp ledger)
        manifest2 = run_quiz.run_quiz(
            config_path=test_config_path,
            scenarios_path=scenarios_path,
            output_dir=output_dir,
            budget_cap=1.0,
            dry_run=True,
            resume_from=manifest_path,
            ledger_path=ledger_path
        )
        
        # Should have same number of calls
        assert len(manifest2["calls"]) == len(manifest1["calls"])


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
