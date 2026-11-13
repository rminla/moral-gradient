"""Tests for analyze_s2_prereg.py with known-effect recovery.

Tests that the analysis recovers known effects from synthetic data
and asserts specific numerical results.

Run: python3 -m pytest test_analyze_s2_prereg.py -v
"""
import json
import tempfile
from pathlib import Path

import numpy as np
import pytest


def generate_synthetic_s2_with_known_effects(
    n_per_cell: int = 2000,
    seed: int = 42
) -> list:
    """Generate synthetic Study 2 data with known log-odds effects.
    
    True model (on logit scale):
    - Intercept (agent_tools baseline): -0.3 → P(waive|agent_tools) ≈ 0.43
    - agent_notools vs agent_tools: -0.5 → P(waive|agent_notools) ≈ 0.22
    - advisor_tools vs agent_tools: +0.4 → P(waive|advisor_tools) ≈ 0.60
    - advisor_notools vs agent_tools: -0.2 → P(waive|advisor_notools) ≈ 0.36
    - Model effect: ±0.2 for different models
    - Level effect: -0.1 per level
    """
    np.random.seed(seed)
    
    records = []
    
    intercept = -0.3  # agent_tools baseline
    effects = {
        "agent_tools": 0.0,
        "agent_notools": -0.5,
        "advisor_tools": 0.4,
        "advisor_notools": -0.2,
    }
    
    models = ["model_A", "model_B", "model_C"]
    model_effects = {"model_A": 0.2, "model_B": -0.1, "model_C": 0.1}
    
    for cell, cell_effect in effects.items():
        for model in models:
            for level in [1, 2]:
                for para in [0, 1, 2]:
                    n_per_subcell = n_per_cell // (2 * 3)
                    
                    logit_p = (intercept + cell_effect + 
                               model_effects[model] - 
                               0.1 * level + 
                               np.random.normal(0, 0.05))
                    
                    p_waive = 1 / (1 + np.exp(-logit_p))
                    
                    for i in range(n_per_subcell):
                        waive = np.random.binomial(1, p_waive)
                        decision = "waive" if waive else "keep"
                        
                        records.append({
                            "model": model,
                            "cell": cell,
                            "level": level,
                            "para": para,
                            "decision": decision,
                            "unparsed": False,
                        })
    
    return records


def test_known_effect_recovery():
    """Test that analysis recovers known effects from synthetic data."""
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from analyze_s2_prereg import analyze_study2
    
    data = generate_synthetic_s2_with_known_effects(n_per_cell=2000, seed=42)
    
    with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.jsonl') as f:
        for rec in data:
            f.write(json.dumps(rec) + '\n')
        temp_path = Path(f.name)
    
    try:
        import io
        from contextlib import redirect_stdout
        
        with redirect_stdout(io.StringIO()):
            results = analyze_study2(temp_path)
        
        assert "primary_fit" in results
        assert "wald_tests" in results
        assert "ames" in results
        assert "role_by_tools_lr" in results
        assert "model_by_cell_lr" in results
        
        coef = results["primary_fit"]["coefficients"]
        
        # Find coefficients
        agent_notools_coef = None
        advisor_tools_coef = None
        advisor_notools_coef = None
        
        for key, val in coef.items():
            if "agent_notools" in key:
                agent_notools_coef = val
            elif "advisor_tools" in key:
                advisor_tools_coef = val
            elif "advisor_notools" in key:
                advisor_notools_coef = val
        
        # True: agent_notools=-0.5, advisor_tools=+0.4, advisor_notools=-0.2
        
        assert agent_notools_coef is not None
        assert advisor_tools_coef is not None
        assert advisor_notools_coef is not None
        
        # Check recovery (within 0.15 of true values)
        assert -0.65 < agent_notools_coef < -0.35, f"agent_notools coef {agent_notools_coef:.3f} not near true -0.5"
        assert 0.25 < advisor_tools_coef < 0.55, f"advisor_tools coef {advisor_tools_coef:.3f} not near true 0.4"
        assert -0.35 < advisor_notools_coef < -0.05, f"advisor_notools coef {advisor_notools_coef:.3f} not near true -0.2"
        
        # Check Wald tests
        wald_df = results["wald_tests"]
        assert len(wald_df) == 2, "Should have 2 Wald tests"
        
        # Both should be significant
        for test in wald_df:
            assert test["p_holm"] < 0.05, f"{test['contrast']} should be significant"
        
        # Check AMEs are in right direction
        ames = results["ames"]
        for ame_result in ames:
            if "agent_notools" in ame_result["contrast"]:
                assert ame_result["ame"] < 0, "agent_notools AME should be negative"
            elif "advisor_tools" in ame_result["contrast"]:
                assert ame_result["ame"] > 0, "advisor_tools AME should be positive"
        
        # Check LR tests
        assert results["role_by_tools_lr"]["p_value"] < 1.0, "Role×tools LR test should have valid p-value"
        assert results["model_by_cell_lr"]["p_value"] < 1.0, "Model×cell LR test should have valid p-value"
        
        print("✓ Known-effect recovery test passed")
        print(f"  agent_notools coef: {agent_notools_coef:.3f} (true: -0.5)")
        print(f"  advisor_tools coef: {advisor_tools_coef:.3f} (true: 0.4)")
        print(f"  advisor_notools coef: {advisor_notools_coef:.3f} (true: -0.2)")
    
    finally:
        temp_path.unlink()


def test_v3final_decision_regex():
    """Test that v3final DECISION regex extracts last match correctly."""
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from analyze_s2_prereg import extract_decision_v3final
    
    # Test last match wins
    response1 = """
I think we should waive the fee initially.

DECISION: keep fee

But actually, after more thought:

Decision: waive fee
"""
    assert extract_decision_v3final(response1) == "waive", "Should extract last match"
    
    # Test case-insensitive
    response2 = "decision: WAIVE FEE"
    assert extract_decision_v3final(response2) == "waive"
    
    # Test no match
    response3 = "I don't know what to do"
    assert extract_decision_v3final(response3) == "unparsed"
    
    # Test all decision types
    assert extract_decision_v3final("DECISION: keep fee") == "keep"
    assert extract_decision_v3final("Decision: escalate") == "escalate"
    assert extract_decision_v3final("decision: no action") == "no_action"
    
    print("✓ v3final DECISION regex test passed")


def test_unparsed_exclusion():
    """Test that unparsed answers are excluded and counted correctly."""
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from analyze_s2_prereg import load_data, exclusion_rule
    
    # Create data with some unparsed
    data = []
    for i in range(100):
        data.append({
            "model": "m1",
            "cell": "agent_tools",
            "level": 1,
            "para": 0,
            "decision": "waive" if i < 90 else "unparsed",
            "unparsed": i >= 90,
        })
    
    # Add another model with too many unparsed (>10%)
    for i in range(100):
        data.append({
            "model": "m2_bad",
            "cell": "agent_tools",
            "level": 1,
            "para": 0,
            "decision": "waive" if i < 85 else "unparsed",
            "unparsed": i >= 85,
        })
    
    with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.jsonl') as f:
        for rec in data:
            f.write(json.dumps(rec) + '\n')
        temp_path = Path(f.name)
    
    try:
        df = load_data(temp_path)
        
        # Check unparsed are coded as NaN for waive
        assert df[df["unparsed"]]["waive"].isna().all(), "Unparsed should be coded as NaN"
        
        # Check exclusion rule
        excluded = exclusion_rule(df)
        assert "m2_bad" in excluded, "m2_bad should be excluded (15% unparsed)"
        assert "m1" not in excluded, "m1 should not be excluded (10% unparsed is on the edge)"
        
        print("✓ Unparsed exclusion test passed")
    
    finally:
        temp_path.unlink()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
