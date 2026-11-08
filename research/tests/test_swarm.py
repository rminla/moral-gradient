"""Tests for swarm harness in dry-run mode."""

import json
import re
import tempfile
from pathlib import Path

import pytest

import sys
sys.path.insert(0, str(Path(__file__).parent.parent / "swarm"))

import run_swarm


def test_action_extraction():
    """Test extracting action codes from responses."""
    pattern = r"(?:DECISION|PROPOSED_ACTION|FINAL_ACTION|FINAL_DECISION):\s*([A-Z_]+)"
    
    # Test valid responses
    assert run_swarm.extract_action("DECISION: PAY_FEE\nRationale: ...", pattern) == "PAY_FEE"
    assert run_swarm.extract_action("PROPOSED_ACTION: CONTEST_FEE", pattern) == "CONTEST_FEE"
    assert run_swarm.extract_action("final_decision: keep_bonus", pattern) == "KEEP_BONUS"
    
    # Test invalid responses
    assert run_swarm.extract_action("I think we should pay the fee", pattern) is None


def test_format_actions_list():
    """Test formatting actions for prompts."""
    actions = [
        {"id": "PAY_FEE", "label": "Pay the fee"},
        {"id": "CONTEST_FEE", "label": "Contest it"}
    ]
    
    formatted = run_swarm.format_actions_list(actions)
    assert "PAY_FEE" in formatted
    assert "CONTEST_FEE" in formatted
    assert "Pay the fee" in formatted


def test_single_episode_dry_run():
    """Test running a single-agent episode in dry-run mode."""
    with tempfile.TemporaryDirectory() as tmpdir:
        # Setup
        cases_path = Path(__file__).parent.parent / "swarm" / "cases.json"
        config_path = Path(__file__).parent.parent / "swarm" / "config.json"
        prompts_path = Path(__file__).parent.parent / "swarm" / "prompts.json"
        
        with open(cases_path) as f:
            cases = json.load(f)
        with open(config_path) as f:
            config = json.load(f)
        with open(prompts_path) as f:
            prompts = json.load(f)
        
        # Create budget tracker and provider
        from lib.budget import BudgetTracker
        from lib.providers import ProviderClient
        
        db_path = Path(tmpdir) / "test.db"
        tracker = BudgetTracker(db_path, global_cap_usd=10.0)
        client = ProviderClient(tracker, "test", dry_run=True)
        
        # Run single episode
        episode = run_swarm.run_single_episode(
            episode_id="test_single_1",
            case=cases["cases"][0],
            model_id="anthropic/claude-haiku-5-5",
            pressure=False,
            config=config,
            prompts=prompts,
            provider_client=client,
            run_id="test_single_episode"
        )
        
        # Verify structure
        assert episode["episode_id"] == "test_single_1"
        assert episode["structure"] == "single"
        assert episode["pressure"] is False
        assert len(episode["turns"]) > 0
        assert episode["total_cost_usd"] > 0


def test_team_episode_dry_run():
    """Test running a team episode in dry-run mode."""
    with tempfile.TemporaryDirectory() as tmpdir:
        # Setup
        cases_path = Path(__file__).parent.parent / "swarm" / "cases.json"
        config_path = Path(__file__).parent.parent / "swarm" / "config.json"
        prompts_path = Path(__file__).parent.parent / "swarm" / "prompts.json"
        
        with open(cases_path) as f:
            cases = json.load(f)
        with open(config_path) as f:
            config = json.load(f)
        with open(prompts_path) as f:
            prompts = json.load(f)
        
        # Create budget tracker and provider
        from lib.budget import BudgetTracker
        from lib.providers import ProviderClient
        
        db_path = Path(tmpdir) / "test.db"
        tracker = BudgetTracker(db_path, global_cap_usd=10.0)
        client = ProviderClient(tracker, "test", dry_run=True)
        
        # Run team episode
        episode = run_swarm.run_team_episode(
            episode_id="test_team_1",
            case=cases["cases"][0],
            model_id="anthropic/claude-haiku-5-5",
            pressure=True,
            config=config,
            prompts=prompts,
            provider_client=client,
            run_id="test_team_episode"
        )
        
        # Verify structure
        assert episode["episode_id"] == "test_team_1"
        assert episode["structure"] == "team"
        assert episode["pressure"] is True
        assert len(episode["turns"]) >= 3  # worker, manager, reviewer minimum
        
        # Check roles
        roles = [t["role"] for t in episode["turns"] if "role" in t]
        assert "worker" in roles
        assert "manager" in roles
        assert "reviewer" in roles


def test_swarm_full_dry_run():
    """Test full swarm run in dry-run mode with minimal config."""
    with tempfile.TemporaryDirectory() as tmpdir:
        output_dir = Path(tmpdir)
        
        config_path = Path(__file__).parent.parent / "swarm" / "config.json"
        cases_path = Path(__file__).parent.parent / "swarm" / "cases.json"
        prompts_path = Path(__file__).parent.parent / "swarm" / "prompts.json"
        
        # Load and modify config for fast test
        with open(config_path) as f:
            config = json.load(f)
        
        test_config_path = Path(tmpdir) / "test_config.json"
        test_config = {
            **config,
            "models": ["anthropic/claude-haiku-5-5"],  # Just one model
            "n_per_arm": 1  # Just 1 episode per arm
        }
        
        with open(test_config_path, 'w') as f:
            json.dump(test_config, f)
        
        # Load and modify cases (just 1 case)
        with open(cases_path) as f:
            cases = json.load(f)
        
        test_cases_path = Path(tmpdir) / "test_cases.json"
        test_cases = {
            **cases,
            "cases": [cases["cases"][0]]  # Just late_fee
        }
        
        with open(test_cases_path, 'w') as f:
            json.dump(test_cases, f)
        
        # Run swarm in dry-run mode (with temp ledger and unique run_id)
        ledger_path = Path(tmpdir) / "test_ledger.db"
        run_id = "test_swarm_full"
        manifest = run_swarm.run_swarm(
            config_path=test_config_path,
            cases_path=test_cases_path,
            prompts_path=prompts_path,
            output_dir=output_dir,
            budget_cap=5.0,
            dry_run=True,
            run_id=run_id,
            ledger_path=ledger_path
        )
        
        # Verify manifest
        assert manifest["version"] == "1.0.0"
        assert manifest["dry_run"] is True
        # 1 model × 1 case × 4 arms × 1 episode = 4 episodes
        assert len(manifest["episodes"]) == 4
        
        # Check summary
        assert manifest["summary"]["total_episodes"] == 4
        assert manifest["summary"]["total_cost_usd"] > 0


def test_turn_limits():
    """Test that episodes respect turn limits."""
    with tempfile.TemporaryDirectory() as tmpdir:
        cases_path = Path(__file__).parent.parent / "swarm" / "cases.json"
        config_path = Path(__file__).parent.parent / "swarm" / "config.json"
        prompts_path = Path(__file__).parent.parent / "swarm" / "prompts.json"
        
        with open(cases_path) as f:
            cases = json.load(f)
        with open(config_path) as f:
            config = json.load(f)
        with open(prompts_path) as f:
            prompts = json.load(f)
        
        from lib.budget import BudgetTracker
        from lib.providers import ProviderClient
        
        db_path = Path(tmpdir) / "test.db"
        tracker = BudgetTracker(db_path, global_cap_usd=10.0)
        client = ProviderClient(tracker, "test", dry_run=True)
        
        # Single episode should not exceed single max_turns
        single_episode = run_swarm.run_single_episode(
            episode_id="test_single",
            case=cases["cases"][0],
            model_id="anthropic/claude-haiku-5-5",
            pressure=False,
            config=config,
            prompts=prompts,
            provider_client=client,
            run_id="test_turn_limits_single"
        )
        
        assert len(single_episode["turns"]) <= config["max_turns"]["single"]
        
        # Team episode should not exceed team max_turns
        team_episode = run_swarm.run_team_episode(
            episode_id="test_team",
            case=cases["cases"][0],
            model_id="anthropic/claude-haiku-5-5",
            pressure=False,
            config=config,
            prompts=prompts,
            provider_client=client,
            run_id="test_turn_limits_team"
        )
        
        assert len(team_episode["turns"]) <= config["max_turns"]["team"]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
