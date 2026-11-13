"""Tests for analyze_s1_prereg.py with known-effect recovery.

Tests that the analysis recovers known effects from synthetic data
and asserts specific numerical results.

Run: python3 -m pytest test_analyze_s1_prereg.py -v
"""
import json
import tempfile
from pathlib import Path

import numpy as np
import pytest


def generate_synthetic_s1_with_known_effects(
    n_per_arm: int = 2000,
    seed: int = 42
) -> list:
    """Generate synthetic Study 1 data with known log-odds effects.
    
    True model (on logit scale):
    - Intercept (ORG baseline): 0.5 → P(keep|ORG) ≈ 0.62
    - SELF vs ORG: +0.4 → P(keep|SELF) ≈ 0.71
    - OTHER vs ORG: -0.3 → P(keep|OTHER) ≈ 0.55
    - NONE vs ORG: +0.6 → P(keep|NONE) ≈ 0.77
    - Model effect: ±0.2 for different models
    - Level effect: -0.1 per level
    - Para effect: small random noise
    """
    np.random.seed(seed)
    
    records = []
    
    # True parameters
    intercept = 0.5  # ORG baseline
    effects = {
        "ORG": 0.0,
        "SELF": 0.4,
        "OTHER": -0.3,
        "NONE": 0.6,
    }
    
    cue_map = {
        "ORG": "benef_org",
        "SELF": "benef_self",
        "OTHER": "benef_other",
        "NONE": "none",
    }
    
    models = ["model_A", "model_B", "model_C", "model_D"]
    model_effects = {"model_A": 0.2, "model_B": -0.1, "model_C": 0.1, "model_D": -0.2}
    
    for arm, arm_effect in effects.items():
        for model in models:
            for level in [1, 2]:
                for para in [0, 1, 2]:
                    n_per_cell = n_per_arm // (2 * 3)  # Divide by levels and paras
                    
                    # True log-odds
                    logit_p = (intercept + arm_effect + 
                               model_effects[model] - 
                               0.1 * level + 
                               np.random.normal(0, 0.05))  # Small para noise
                    
                    p_keep = 1 / (1 + np.exp(-logit_p))
                    
                    for i in range(n_per_cell):
                        keep = np.random.binomial(1, p_keep)
                        outcome = "keep" if keep else "act"
                        
                        records.append({
                            "model": model,
                            "cue": cue_map[arm],
                            "level": level,
                            "para": para,
                            "outcome": outcome,
                        })
    
    return records


def test_known_effect_recovery():
    """Test that analysis recovers known effects from synthetic data."""
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from analyze_s1_prereg import analyze_study1
    
    # Generate data with known effects
    data = generate_synthetic_s1_with_known_effects(n_per_arm=2000, seed=42)
    
    with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.jsonl') as f:
        for rec in data:
            f.write(json.dumps(rec) + '\n')
        temp_path = Path(f.name)
    
    try:
        # Run analysis (suppress output)
        import io
        from contextlib import redirect_stdout
        
        with redirect_stdout(io.StringIO()):
            results = analyze_study1(temp_path)
        
        # Check structure
        assert "primary_fit" in results
        assert "wald_tests" in results
        assert "org_vs_none_gate" in results
        assert "ames" in results
        assert "arm_by_model_lr" in results
        
        # Extract coefficients
        coef = results["primary_fit"]["coefficients"]
        
        # Find SELF, OTHER, NONE coefficients (vs ORG reference)
        self_coef = None
        other_coef = None
        none_coef = None
        
        for key, val in coef.items():
            if "SELF" in key:
                self_coef = val
            elif "OTHER" in key:
                other_coef = val
            elif "NONE" in key:
                none_coef = val
        
        # Assert recovery within reasonable bounds
        # True: SELF=+0.4, OTHER=-0.3, NONE=+0.6
        
        assert self_coef is not None, "SELF coefficient not found"
        assert other_coef is not None, "OTHER coefficient not found"
        assert none_coef is not None, "NONE coefficient not found"
        
        # With n=2000 per arm, estimates should be very precise
        # Check they're in the right ballpark (within 0.15 of true values)
        assert 0.25 < self_coef < 0.55, f"SELF coef {self_coef:.3f} not near true 0.4"
        assert -0.45 < other_coef < -0.15, f"OTHER coef {other_coef:.3f} not near true -0.3"
        assert 0.45 < none_coef < 0.75, f"NONE coef {none_coef:.3f} not near true 0.6"
        
        # Check Wald tests
        wald_df = results["wald_tests"]
        assert len(wald_df) == 2, "Should have 2 Wald tests (SELF vs ORG, OTHER vs ORG)"
        
        # Both should be significant with this large n
        for test in wald_df:
            assert test["p_holm"] < 0.05, f"{test['contrast']} should be significant"
        
        # Check ORG vs NONE gate
        gate = results["org_vs_none_gate"]
        assert gate["passed"], "ORG vs NONE should pass (large positive effect)"
        assert gate["p"] < 0.05, "ORG vs NONE p-value should be < 0.05"
        
        # Check AMEs are in right direction
        ames = results["ames"]
        for ame_result in ames:
            if "SELF" in ame_result["contrast"]:
                # SELF has positive effect, so higher keep rate
                assert ame_result["ame"] > 0, "SELF AME should be positive"
                # CI should not include 0
                assert ame_result["ci_lower"] > 0, "SELF CI should exclude 0"
            elif "OTHER" in ame_result["contrast"]:
                # OTHER has negative effect, so lower keep rate
                assert ame_result["ame"] < 0, "OTHER AME should be negative"
            elif "NONE" in ame_result["contrast"]:
                # NONE has positive effect
                assert ame_result["ame"] > 0, "NONE AME should be positive"
        
        print("✓ Known-effect recovery test passed")
        print(f"  SELF coef: {self_coef:.3f} (true: 0.4)")
        print(f"  OTHER coef: {other_coef:.3f} (true: -0.3)")
        print(f"  NONE coef: {none_coef:.3f} (true: 0.6)")
    
    finally:
        temp_path.unlink()


def test_no_action_counts_as_keep():
    """Test that no_action counts as keep (not dropped)."""
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from analyze_s1_prereg import load_data
    
    # Create data with no_action outcomes
    data = [
        {"model": "m1", "cue": "benef_org", "level": 1, "para": 0, "outcome": "keep"},
        {"model": "m1", "cue": "benef_org", "level": 1, "para": 1, "outcome": "no_action"},
        {"model": "m1", "cue": "benef_org", "level": 1, "para": 2, "outcome": "act"},
    ]
    
    with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.jsonl') as f:
        for rec in data:
            f.write(json.dumps(rec) + '\n')
        temp_path = Path(f.name)
    
    try:
        df = load_data(temp_path)
        
        # Check that no_action is coded as keep=1
        no_action_row = df[df["outcome"] == "no_action"]
        assert len(no_action_row) == 1
        assert no_action_row["keep"].iloc[0] == 1, "no_action should be coded as keep=1"
        
        # Check that escalate also counts as keep
        data_with_escalate = data + [
            {"model": "m1", "cue": "benef_org", "level": 1, "para": 0, "outcome": "escalate"}
        ]
        
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.jsonl') as f2:
            for rec in data_with_escalate:
                f2.write(json.dumps(rec) + '\n')
            temp_path2 = Path(f2.name)
        
        df2 = load_data(temp_path2)
        escalate_row = df2[df2["outcome"] == "escalate"]
        assert len(escalate_row) == 1
        assert escalate_row["keep"].iloc[0] == 1, "escalate should be coded as keep=1"
        
        temp_path2.unlink()
        
        print("✓ no_action and escalate count as keep")
    
    finally:
        temp_path.unlink()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
