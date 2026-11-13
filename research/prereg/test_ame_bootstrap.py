#!/usr/bin/env python3
"""Test that AME bootstrap CIs are non-degenerate and cover true effects.

This validates deviation-1 fix: bootstrap refits model on each draw.
"""
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO_ROOT / "research" / "prereg"))

from analyze_s1_prereg import compute_ames_with_cis as compute_ames_s1
from analyze_s2_prereg import compute_ames_with_cis as compute_ames_s2
from statsmodels.formula.api import logit


def fit_logistic_for_test(df, formula):
    """Fit logistic regression for test purposes (faster than Firth)."""
    model = logit(formula, data=df).fit(disp=0, maxiter=100)
    
    return {
        "coefficients": dict(model.params),
        "se": dict(model.bse),
        "formula": formula,
    }


def generate_synthetic_data_s1(n=2000, true_ame_self=0.15, true_ame_other=-0.10):
    """Generate synthetic Study 1 data with known AMEs."""
    np.random.seed(123)
    
    arms = ["ORG", "SELF", "OTHER", "NONE"]
    models = ["model_a", "model_b"]
    
    records = []
    for model in models:
        for arm in arms:
            n_arm = n // (len(arms) * len(models))
            
            # Base probability for ORG
            p_base = 0.50
            
            # Add true treatment effects
            if arm == "SELF":
                p = p_base + true_ame_self
            elif arm == "OTHER":
                p = p_base + true_ame_other
            elif arm == "NONE":
                p = p_base - 0.05
            else:  # ORG
                p = p_base
            
            # Add level and para effects
            for i in range(n_arm):
                level = 4 + (i % 2)  # Levels 4, 5
                para = i % 3
                
                # Add small covariate effects
                p_i = p + 0.02 * (level - 4.5) + 0.01 * (para - 1)
                p_i = max(0.01, min(0.99, p_i))
                
                keep = int(np.random.random() < p_i)
                
                records.append({
                    "model": model,
                    "arm": arm,
                    "level_index": level,
                    "para_cat": str(para),
                    "keep": keep,
                })
    
    return pd.DataFrame(records)


def generate_synthetic_data_s2(n=2000, true_ame_notools=0.18, true_ame_advisor=-0.12):
    """Generate synthetic Study 2 data with known AMEs."""
    np.random.seed(456)
    
    cells = ["agent_tools", "agent_notools", "advisor_tools", "advisor_notools"]
    models = ["model_a", "model_b"]
    
    records = []
    for model in models:
        for cell in cells:
            n_cell = n // (len(cells) * len(models))
            
            # Base probability for agent_tools
            p_base = 0.45
            
            # Add true treatment effects
            if cell == "agent_notools":
                p = p_base + true_ame_notools
            elif cell == "advisor_tools":
                p = p_base + true_ame_advisor
            elif cell == "advisor_notools":
                p = p_base + true_ame_notools + true_ame_advisor  # Both effects
            else:  # agent_tools
                p = p_base
            
            # Add level and para effects
            for i in range(n_cell):
                level = 4 + (i % 2)
                para = i % 3
                
                p_i = p + 0.02 * (level - 4.5) + 0.01 * (para - 1)
                p_i = max(0.01, min(0.99, p_i))
                
                waive = int(np.random.random() < p_i)
                
                records.append({
                    "model": model,
                    "cell": cell,
                    "level_index": level,
                    "para_cat": str(para),
                    "waive": waive,
                })
    
    return pd.DataFrame(records)


def test_s1_ame_ci_non_degenerate():
    """Test that S1 AME CIs are non-degenerate (width > 0)."""
    df = generate_synthetic_data_s1(n=1000)  # Smaller sample for faster test
    
    formula = "keep ~ C(arm, Treatment(reference='ORG')) + C(model) + level_index + C(para_cat)"
    fit_result = fit_logistic_for_test(df, formula)
    ame_results = compute_ames_s1(df, fit_result)
    
    print("\nS1 AME Results:")
    print(ame_results)
    
    for _, row in ame_results.iterrows():
        contrast = row["contrast"]
        ame = row["ame"]
        ci_lower = row["ci_lower"]
        ci_upper = row["ci_upper"]
        
        # CI should be non-degenerate
        ci_width = ci_upper - ci_lower
        assert ci_width > 0.001, f"{contrast}: CI width {ci_width:.6f} is degenerate (near zero)"
        
        # CI should be reasonable (not absurdly wide)
        assert ci_width < 1.0, f"{contrast}: CI width {ci_width:.3f} is unreasonably wide"
        
        print(f"✓ {contrast}: AME={ame:.3f}, CI=[{ci_lower:.3f}, {ci_upper:.3f}], width={ci_width:.3f}")


def test_s1_ame_ci_covers_true_effect():
    """Test that S1 AME CIs cover the true synthetic AME."""
    true_ame_self = 0.15
    true_ame_other = -0.10
    
    df = generate_synthetic_data_s1(n=2000, true_ame_self=true_ame_self, true_ame_other=true_ame_other)
    
    formula = "keep ~ C(arm, Treatment(reference='ORG')) + C(model) + level_index + C(para_cat)"
    fit_result = fit_logistic_for_test(df, formula)
    ame_results = compute_ames_s1(df, fit_result)
    
    print("\nS1 AME Coverage Test:")
    print(ame_results)
    
    # Check SELF vs ORG
    self_row = ame_results[ame_results["contrast"] == "SELF_vs_ORG"].iloc[0]
    assert self_row["ci_lower"] <= true_ame_self <= self_row["ci_upper"], \
        f"SELF CI [{self_row['ci_lower']:.3f}, {self_row['ci_upper']:.3f}] does not cover true AME {true_ame_self:.3f}"
    print(f"✓ SELF: True AME {true_ame_self:.3f} covered by CI [{self_row['ci_lower']:.3f}, {self_row['ci_upper']:.3f}]")
    
    # Check OTHER vs ORG
    other_row = ame_results[ame_results["contrast"] == "OTHER_vs_ORG"].iloc[0]
    assert other_row["ci_lower"] <= true_ame_other <= other_row["ci_upper"], \
        f"OTHER CI [{other_row['ci_lower']:.3f}, {other_row['ci_upper']:.3f}] does not cover true AME {true_ame_other:.3f}"
    print(f"✓ OTHER: True AME {true_ame_other:.3f} covered by CI [{other_row['ci_lower']:.3f}, {other_row['ci_upper']:.3f}]")


def test_s2_ame_ci_non_degenerate():
    """Test that S2 AME CIs are non-degenerate (width > 0)."""
    df = generate_synthetic_data_s2(n=1000)
    
    formula = "waive ~ C(cell, Treatment(reference='agent_tools')) + C(model) + level_index + C(para_cat)"
    fit_result = fit_logistic_for_test(df, formula)
    ame_results = compute_ames_s2(df, fit_result)
    
    print("\nS2 AME Results:")
    print(ame_results)
    
    for _, row in ame_results.iterrows():
        contrast = row["contrast"]
        ame = row["ame"]
        ci_lower = row["ci_lower"]
        ci_upper = row["ci_upper"]
        
        # CI should be non-degenerate
        ci_width = ci_upper - ci_lower
        assert ci_width > 0.001, f"{contrast}: CI width {ci_width:.6f} is degenerate (near zero)"
        
        # CI should be reasonable
        assert ci_width < 1.0, f"{contrast}: CI width {ci_width:.3f} is unreasonably wide"
        
        print(f"✓ {contrast}: AME={ame:.3f}, CI=[{ci_lower:.3f}, {ci_upper:.3f}], width={ci_width:.3f}")


def test_s2_ame_ci_covers_true_effect():
    """Test that S2 AME CIs cover the true synthetic AME."""
    true_ame_notools = 0.18
    true_ame_advisor = -0.12
    
    df = generate_synthetic_data_s2(n=2000, true_ame_notools=true_ame_notools, true_ame_advisor=true_ame_advisor)
    
    formula = "waive ~ C(cell, Treatment(reference='agent_tools')) + C(model) + level_index + C(para_cat)"
    fit_result = fit_logistic_for_test(df, formula)
    ame_results = compute_ames_s2(df, fit_result)
    
    print("\nS2 AME Coverage Test:")
    print(ame_results)
    
    # Check agent_notools
    notools_row = ame_results[ame_results["contrast"] == "agent_notools_vs_agent_tools"].iloc[0]
    assert notools_row["ci_lower"] <= true_ame_notools <= notools_row["ci_upper"], \
        f"agent_notools CI [{notools_row['ci_lower']:.3f}, {notools_row['ci_upper']:.3f}] does not cover true AME {true_ame_notools:.3f}"
    print(f"✓ agent_notools: True AME {true_ame_notools:.3f} covered by CI [{notools_row['ci_lower']:.3f}, {notools_row['ci_upper']:.3f}]")
    
    # Check advisor_tools
    advisor_row = ame_results[ame_results["contrast"] == "advisor_tools_vs_agent_tools"].iloc[0]
    assert advisor_row["ci_lower"] <= true_ame_advisor <= advisor_row["ci_upper"], \
        f"advisor_tools CI [{advisor_row['ci_lower']:.3f}, {advisor_row['ci_upper']:.3f}] does not cover true AME {true_ame_advisor:.3f}"
    print(f"✓ advisor_tools: True AME {true_ame_advisor:.3f} covered by CI [{advisor_row['ci_lower']:.3f}, {advisor_row['ci_upper']:.3f}]")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
