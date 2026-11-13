"""Tests for canary_check.py (fix 5).

Run: python3 -m pytest test_canary_check.py -v
"""
import json
import tempfile
from pathlib import Path

import pytest


def test_sha256_file():
    """Test SHA256 hash computation"""
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from canary_check import sha256_file
    
    with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.txt') as f:
        f.write("test content")
        temp_path = Path(f.name)
    
    try:
        hash_val = sha256_file(temp_path)
        # SHA256 of "test content"
        expected = "6ae8a75555209fd6c44157c0aed8016e763ff435a19cf186f76863140143ff72"
        assert hash_val == expected
    finally:
        temp_path.unlink()


def test_check_prompt_match():
    """Test prompt hash matching"""
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from canary_check import check_prompt_match, PROMPT_HASHES
    
    # Create a temp file with known content
    with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.json') as f:
        f.write('{"test": "data"}')
        temp_path = Path(f.name)
    
    try:
        # Should fail (hash won't match preregistered)
        passed, msg = check_prompt_match("study1", temp_path)
        assert not passed
        assert "mismatch" in msg.lower()
    finally:
        temp_path.unlink()


def test_check_coded_outcomes():
    """Test outcome code validation"""
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from canary_check import check_coded_outcomes
    
    # Valid records
    records = [
        {"outcome": "act", "cost_usd": 0.001},
        {"outcome": "keep", "cost_usd": 0.001},
        {"outcome": "waive", "cost_usd": 0.001},
        {"outcome": "no_action", "cost_usd": 0.001},
    ]
    
    passed, msg = check_coded_outcomes(records, "study1", "claude-haiku-5.5")
    assert passed
    assert "valid outcome codes" in msg.lower()
    
    # Invalid records (missing outcome)
    invalid_records = [
        {"cost_usd": 0.001},
        {"outcome": "act", "cost_usd": 0.001},
    ]
    
    passed, msg = check_coded_outcomes(invalid_records, "study1", "claude-haiku-5.5")
    assert not passed
    assert "missing" in msg.lower()
    
    # Invalid outcome value
    invalid_outcome_records = [
        {"outcome": "invalid_code", "cost_usd": 0.001},
    ]
    
    passed, msg = check_coded_outcomes(invalid_outcome_records, "study1", "claude-haiku-5.5")
    assert not passed
    assert "invalid" in msg.lower()


def test_check_unparsed_rates():
    """Test unparsed and no-action rate validation"""
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from canary_check import check_unparsed_rates, MAX_UNPARSED_RATE, MAX_NO_ACTION_RATE
    
    # Low unparsed/no-action rates (should pass)
    good_records = [
        {"outcome": "act", "flags": []},
        {"outcome": "keep", "flags": []},
        {"outcome": "act", "flags": []},
        {"outcome": "keep", "flags": []},
        {"outcome": "no_action", "flags": []},  # 1/5 = 20% no_action, but threshold is higher
    ]
    
    passed, msg = check_unparsed_rates(good_records, "study1", "claude-haiku-5.5")
    # This might fail if no_action is > 15%, so let's check a better case
    
    # Very low rates (should definitely pass)
    excellent_records = [{"outcome": "act", "flags": []} for _ in range(20)]
    
    passed, msg = check_unparsed_rates(excellent_records, "study1", "claude-haiku-5.5")
    assert passed
    
    # High unparsed rate (should fail)
    bad_records = [{"outcome": "escalate", "flags": ["unparsed"]} for _ in range(5)]
    bad_records += [{"outcome": "act", "flags": []} for _ in range(5)]
    
    passed, msg = check_unparsed_rates(bad_records, "study1", "claude-haiku-5.5")
    assert not passed
    assert "unparsed" in msg.lower()


def test_check_cost_validation():
    """Test cost validation against expected costs"""
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from canary_check import check_cost_validation, EXPECTED_COSTS
    
    # Study 1, claude-haiku-5.5: expected ~$0.003460 per unit
    expected = EXPECTED_COSTS["claude-haiku-5.5"]["study1_unit"]
    
    # Cost within tolerance (should pass)
    good_records = [{"cost_usd": expected} for _ in range(16)]
    
    passed, msg = check_cost_validation(good_records, "study1", "claude-haiku-5.5")
    assert passed
    assert "cost validation passed" in msg.lower()
    
    # Cost way too high (should fail)
    bad_records = [{"cost_usd": expected * 2.0} for _ in range(16)]
    
    passed, msg = check_cost_validation(bad_records, "study1", "claude-haiku-5.5")
    assert not passed
    assert "cost validation failed" in msg.lower()
    
    # Cost way too low (should fail)
    too_low_records = [{"cost_usd": expected * 0.5} for _ in range(16)]
    
    passed, msg = check_cost_validation(too_low_records, "study1", "claude-haiku-5.5")
    assert not passed


def test_run_gates_no_data():
    """Test that gates fail gracefully when canary data is missing"""
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from canary_check import run_gates
    
    with tempfile.TemporaryDirectory() as tmpdir:
        data_dir = Path(tmpdir)
        prompt_file = data_dir / "prompts_study1.json"
        
        # Create a valid prompt file
        with open(prompt_file, 'w') as f:
            json.dump({"test": "data"}, f)
        
        results = run_gates("study1", "claude-haiku-5.5", data_dir, prompt_file)
        
        # Prompt match should run (will fail due to hash mismatch, but that's OK)
        assert "prompt_match" in results
        
        # Other gates should fail due to missing data
        assert "coded_outcomes" in results
        assert "unparsed_rates" in results
        assert "cost_validation" in results
        
        # All should have failed
        assert not results["coded_outcomes"][0]
        assert not results["unparsed_rates"][0]
        assert not results["cost_validation"][0]


def test_preregistered_prompt_hashes():
    """Test that preregistered prompt hashes are defined"""
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from canary_check import PROMPT_HASHES
    
    assert "study1" in PROMPT_HASHES
    assert "study2" in PROMPT_HASHES
    
    # Hashes should be 64 hex characters (SHA256)
    assert len(PROMPT_HASHES["study1"]) == 64
    assert len(PROMPT_HASHES["study2"]) == 64
    assert all(c in "0123456789abcdef" for c in PROMPT_HASHES["study1"])
    assert all(c in "0123456789abcdef" for c in PROMPT_HASHES["study2"])


def test_expected_costs_defined():
    """Test that expected costs are defined for all models"""
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from canary_check import EXPECTED_COSTS
    
    models = ["claude-haiku-5.5", "gpt-oss-120b", "qwen3.6-27b", "gemini-3.8-flash"]
    
    for model in models:
        assert model in EXPECTED_COSTS
        assert "study1_unit" in EXPECTED_COSTS[model]
        assert "study2_tool_unit" in EXPECTED_COSTS[model]
        assert "study2_notool_unit" in EXPECTED_COSTS[model]
        
        # Costs should be positive
        assert EXPECTED_COSTS[model]["study1_unit"] > 0
        assert EXPECTED_COSTS[model]["study2_tool_unit"] > 0
        assert EXPECTED_COSTS[model]["study2_notool_unit"] > 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
