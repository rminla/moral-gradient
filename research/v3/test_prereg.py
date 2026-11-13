"""Tests for preregistered studies - ensures specs match JSON files"""

import json
import re
from collections import Counter
from pathlib import Path

import pytest

from .cases import car_si_case, car_role_spec, get_cue_arms
from .constants import CALIBRATED_LEVELS, load_study_prompts
from .run import plan, MockClient, execute_unit, execute_role_notools


class TestStudy1Specs:
    """Test that rendered Study 1 specs match prompts_study1.json"""
    
    def test_org_cue_matches_json(self):
        """Test that benef_org cases match prompts_study1.json"""
        prompts_s1 = load_study_prompts(1)
        
        # Test for each model and level
        for model, levels in CALIBRATED_LEVELS.items():
            for level in levels:
                for para in range(3):
                    # Generate case
                    case = car_si_case("benef_org", "incentive", para, level)
                    
                    # Find matching spec in JSON
                    model_specs = prompts_s1["specs"][model]["org"]
                    matching = [s for s in model_specs if s["para"] == para and s["level"] == level and s["kind"] == "do"]
                    
                    assert len(matching) == 1, f"Expected 1 matching spec for {model} para={para} level={level}"
                    expected = matching[0]
                    
                    # Check byte-identical system and user prompts
                    assert case["system"] == expected["system"], f"System prompt mismatch for {model} para={para} level={level}"
                    assert case["user"] == expected["user"], f"User prompt mismatch for {model} para={para} level={level}"
    
    def test_self_cue_matches_json(self):
        """Test that benef_self cases match prompts_study1.json"""
        prompts_s1 = load_study_prompts(1)
        
        for model, levels in CALIBRATED_LEVELS.items():
            for level in levels:
                case = car_si_case("benef_self", "incentive", 0, level)
                
                model_specs = prompts_s1["specs"][model]["self"]
                matching = [s for s in model_specs if s["para"] == 0 and s["level"] == level and s["kind"] == "do"]
                
                assert len(matching) == 1
                expected = matching[0]
                
                assert case["system"] == expected["system"]
                assert case["user"] == expected["user"]
    
    def test_other_cue_matches_json(self):
        """Test that benef_other cases match prompts_study1.json"""
        prompts_s1 = load_study_prompts(1)
        
        for model, levels in CALIBRATED_LEVELS.items():
            for level in levels:
                case = car_si_case("benef_other", "incentive", 0, level)
                
                model_specs = prompts_s1["specs"][model]["other"]
                matching = [s for s in model_specs if s["para"] == 0 and s["level"] == level and s["kind"] == "do"]
                
                assert len(matching) == 1
                expected = matching[0]
                
                assert case["system"] == expected["system"]
                assert case["user"] == expected["user"]
    
    def test_none_cue_matches_json(self):
        """Test that none cases match prompts_study1.json"""
        prompts_s1 = load_study_prompts(1)
        
        for model, levels in CALIBRATED_LEVELS.items():
            for level in levels:
                case = car_si_case("none", "neutral", 0, level)
                
                model_specs = prompts_s1["specs"][model]["none"]
                matching = [s for s in model_specs if s["para"] == 0 and s["level"] == level and s["kind"] == "do"]
                
                assert len(matching) == 1
                expected = matching[0]
                
                assert case["system"] == expected["system"]
                assert case["user"] == expected["user"]


class TestStudy2Specs:
    """Test that rendered Study 2 specs match prompts_study2.json"""
    
    def test_agent_tools_matches_json(self):
        """Test that agent_tools cases match prompts_study2.json"""
        prompts_s2 = load_study_prompts(2)
        
        for model, levels in CALIBRATED_LEVELS.items():
            for level in levels:
                for para in range(3):
                    case = car_role_spec("agent", True, para, level)
                    
                    model_specs = prompts_s2["specs"][model]["agent_tools"]
                    matching = [s for s in model_specs if s["para"] == para and s["level"] == level]
                    
                    assert len(matching) == 1
                    expected = matching[0]
                    
                    assert case["system"] == expected["system"]
                    assert case["user"] == expected["user"]
                    assert case["tools"] == expected["tools"]
    
    def test_agent_notools_matches_json(self):
        """Test that agent_notools cases match prompts_study2.json"""
        prompts_s2 = load_study_prompts(2)
        
        for model, levels in CALIBRATED_LEVELS.items():
            for level in levels:
                case = car_role_spec("agent", False, 0, level)
                
                model_specs = prompts_s2["specs"][model]["agent_notools"]
                matching = [s for s in model_specs if s["para"] == 0 and s["level"] == level]
                
                assert len(matching) == 1
                expected = matching[0]
                
                assert case["system"] == expected["system"]
                assert case["user"] == expected["user"]
                assert case["tools"] is None or case["tools"] == []
    
    def test_advisor_tools_matches_json(self):
        """Test that advisor_tools cases match prompts_study2.json"""
        prompts_s2 = load_study_prompts(2)
        
        for model, levels in CALIBRATED_LEVELS.items():
            for level in levels:
                case = car_role_spec("advisor", True, 0, level)
                
                model_specs = prompts_s2["specs"][model]["advisor_tools"]
                matching = [s for s in model_specs if s["para"] == 0 and s["level"] == level]
                
                assert len(matching) == 1
                expected = matching[0]
                
                assert case["system"] == expected["system"]
    
    def test_advisor_notools_matches_json(self):
        """Test that advisor_notools cases match prompts_study2.json"""
        prompts_s2 = load_study_prompts(2)
        
        for model, levels in CALIBRATED_LEVELS.items():
            for level in levels:
                case = car_role_spec("advisor", False, 0, level)
                
                model_specs = prompts_s2["specs"][model]["advisor_notools"]
                matching = [s for s in model_specs if s["para"] == 0 and s["level"] == level]
                
                assert len(matching) == 1
                expected = matching[0]
                
                assert case["system"] == expected["system"]


class TestPlannedUnits:
    """Test that planned unit counts match preregistration"""
    
    def test_study1_main_counts(self):
        """Study 1 main: 4 arms × 24 per cue × 4 models = 384 units"""
        units = plan(
            iter_name="s1-benef",
            stage="main",
            phases=["si"],
            cues=["benef_org", "benef_self", "benef_other", "none"],
            cue_n={"benef_org": 24, "benef_self": 24, "benef_other": 24, "none": 24},
            reuse_calibration="v3final",
        )
        
        # Total units
        assert len(units) == 4 * 24 * 4, f"Expected 384 units, got {len(units)}"
        
        # Check per-cue counts
        cue_counts = Counter(u["cue"] for u in units)
        for cue in ["benef_org", "benef_self", "benef_other", "none"]:
            assert cue_counts[cue] == 24 * 4, f"Expected 96 units for {cue}, got {cue_counts[cue]}"
        
        # Check per-model counts
        model_counts = Counter(u["model"] for u in units)
        for model in CALIBRATED_LEVELS.keys():
            assert model_counts[model] == 4 * 24, f"Expected 96 units for {model}, got {model_counts[model]}"
    
    def test_study1_canary_counts(self):
        """Study 1 canary: 4 arms × 8 per cue × 4 models = 128 units"""
        units = plan(
            iter_name="s1-benef-canary",
            stage="canary",
            phases=["si"],
            cues=["benef_org", "benef_self", "benef_other", "none"],
            cue_n={"benef_org": 8, "benef_self": 8, "benef_other": 8, "none": 8},
            reuse_calibration="v3final",
        )
        
        assert len(units) == 4 * 8 * 4, f"Expected 128 units, got {len(units)}"
    
    def test_study2_main_counts(self):
        """Study 2 main: 4 cells × 24 per level × 4 models = 384 units"""
        units = plan(
            iter_name="s2-role",
            stage="main",
            phases=["role"],
            role_n=24,
            reuse_calibration="v3final",
        )
        
        assert len(units) == 4 * 24 * 4, f"Expected 384 units, got {len(units)}"
        
        # Check per-cell counts
        cell_counts = Counter(u["cell"] for u in units)
        for cell in ["agent_tools", "agent_notools", "advisor_tools", "advisor_notools"]:
            assert cell_counts[cell] == 24 * 4, f"Expected 96 units for {cell}, got {cell_counts[cell]}"
    
    def test_study2_canary_counts(self):
        """Study 2 canary: 4 cells × 8 per level × 4 models = 128 units"""
        units = plan(
            iter_name="s2-role-canary",
            stage="canary",
            phases=["role"],
            role_n=8,
            reuse_calibration="v3final",
        )
        
        assert len(units) == 4 * 8 * 4, f"Expected 128 units, got {len(units)}"
    
    def test_balanced_across_levels_and_paraphrases(self):
        """Test that units are balanced across levels and paraphrases"""
        units = plan(
            iter_name="s1-benef",
            stage="main",
            phases=["si"],
            cues=["benef_org"],
            cue_n={"benef_org": 24},
            reuse_calibration="v3final",
        )
        
        # Should have roughly equal distribution across levels and paraphrases
        for model in CALIBRATED_LEVELS.keys():
            model_units = [u for u in units if u["model"] == model]
            
            # Count by level
            level_counts = Counter(u["level"] for u in model_units)
            # Should be balanced (12 per level for 2 levels)
            assert abs(level_counts[CALIBRATED_LEVELS[model][0]] - 12) <= 1
            assert abs(level_counts[CALIBRATED_LEVELS[model][1]] - 12) <= 1
            
            # Count by para
            para_counts = Counter(u["para"] for u in model_units)
            # Should be balanced (8 per para for 3 paras)
            for para in range(3):
                assert abs(para_counts[para] - 8) <= 1
    
    def test_unique_keys(self):
        """Test that all unit keys are unique"""
        units = plan(
            iter_name="s1-benef",
            stage="main",
            phases=["si"],
            cues=["benef_org", "benef_self"],
            cue_n={"benef_org": 24, "benef_self": 24},
            reuse_calibration="v3final",
        )
        
        keys = [u["key"] for u in units]
        assert len(keys) == len(set(keys)), "Duplicate keys found"


class TestSingleArmCues:
    """Test that single-arm cues produce no neutral units"""
    
    def test_benef_org_only_incentive(self):
        """benef_org should only produce incentive units"""
        units = plan(
            iter_name="s1-benef",
            stage="main",
            phases=["si"],
            cues=["benef_org"],
            cue_n={"benef_org": 24},
            reuse_calibration="v3final",
        )
        
        arms = set(u["arm"] for u in units)
        assert arms == {"incentive"}, f"Expected only incentive, got {arms}"
    
    def test_none_only_neutral(self):
        """none should only produce neutral units"""
        units = plan(
            iter_name="s1-benef",
            stage="main",
            phases=["si"],
            cues=["none"],
            cue_n={"none": 24},
            reuse_calibration="v3final",
        )
        
        arms = set(u["arm"] for u in units)
        assert arms == {"neutral"}, f"Expected only neutral, got {arms}"


class TestDecisionParser:
    """Test the no-tools DECISION parser"""
    
    def test_waive_fee_lowercase(self):
        """Test parsing 'DECISION: waive_fee'"""
        from .run import execute_role_notools
        
        # Mock result with DECISION
        class MockClient:
            def chat(self, messages, tools=None):
                return {
                    "choices": [{
                        "message": {
                            "content": "I recommend waiving the fee.\n\nDECISION: waive_fee"
                        }
                    }]
                }
        
        unit = {"phase": "role", "model": "test", "cell": "agent_notools", "tools": False}
        case = {"system": "test", "user": "test", "decisions": ["waive_fee", "keep_fee"]}
        
        result = execute_role_notools(unit, case, MockClient())
        
        assert result["outcome"] == "waive"
        assert not result["unparsed"]
    
    def test_keep_fee_uppercase(self):
        """Test parsing 'DECISION: KEEP_FEE' (case-insensitive)"""
        class MockClient:
            def chat(self, messages, tools=None):
                return {
                    "choices": [{
                        "message": {
                            "content": "DECISION: KEEP_FEE"
                        }
                    }]
                }
        
        unit = {"phase": "role", "model": "test", "cell": "agent_notools", "tools": False}
        case = {"system": "test", "user": "test", "decisions": ["waive_fee", "keep_fee"]}
        
        result = execute_role_notools(unit, case, MockClient())
        
        assert result["outcome"] == "keep"
    
    def test_bold_markup_tolerated(self):
        """Test parsing '**DECISION: waive_fee**' (bold markup)"""
        class MockClient:
            def chat(self, messages, tools=None):
                return {
                    "choices": [{
                        "message": {
                            "content": "**DECISION: waive_fee**"
                        }
                    }]
                }
        
        unit = {"phase": "role", "model": "test", "cell": "agent_notools", "tools": False}
        case = {"system": "test", "user": "test", "decisions": ["waive_fee", "keep_fee"]}
        
        result = execute_role_notools(unit, case, MockClient())
        
        assert result["outcome"] == "waive"
    
    def test_last_line_wins(self):
        """Test that last DECISION line wins"""
        class MockClient:
            def chat(self, messages, tools=None):
                return {
                    "choices": [{
                        "message": {
                            "content": "DECISION: keep_fee\n\nActually, on second thought:\n\nDECISION: waive_fee"
                        }
                    }]
                }
        
        unit = {"phase": "role", "model": "test", "cell": "agent_notools", "tools": False}
        case = {"system": "test", "user": "test", "decisions": ["waive_fee", "keep_fee"]}
        
        result = execute_role_notools(unit, case, MockClient())
        
        assert result["outcome"] == "waive"


class TestNoPaidCalls:
    """Test that no paid API calls are made"""
    
    def test_mock_client_used(self):
        """Test that MockClient is used in tests"""
        client = MockClient("test")
        response = client.chat([{"role": "user", "content": "test"}])
        
        # Should return mock response
        assert "choices" in response
        assert "usage" in response
    
    def test_no_real_api_keys_needed(self):
        """Test that tests pass without real API keys"""
        import os
        
        # Temporarily clear API keys
        old_keys = {}
        for key in ["ANTHROPIC_API_KEY", "GROQ_API_KEY", "OPENROUTER_API_KEY"]:
            old_keys[key] = os.environ.get(key)
            if key in os.environ:
                del os.environ[key]
        
        try:
            # Tests should still pass
            units = plan(
                iter_name="s1-benef-canary",
                stage="canary",
                phases=["si"],
                cues=["benef_org"],
                cue_n={"benef_org": 8},
                reuse_calibration="v3final",
            )
            
            assert len(units) > 0
        
        finally:
            # Restore keys
            for key, value in old_keys.items():
                if value is not None:
                    os.environ[key] = value


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
