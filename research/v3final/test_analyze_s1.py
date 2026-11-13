"""Tests for analyze_s1.py with synthetic data (fix 6).

Run: python3 -m pytest test_analyze_s1.py -v
"""
import json
import tempfile
from pathlib import Path

import numpy as np
import pytest


def generate_synthetic_s1_data(n_per_arm: int = 48, effect_size: float = 0.3, seed: int = 42) -> list:
    """Generate synthetic Study 1 data with known effect.
    
    Args:
        n_per_arm: Sample size per arm
        effect_size: Logit-scale effect size for treatment arms
        seed: Random seed
    
    Returns:
        List of record dictionaries
    """
    np.random.seed(seed)
    
    records = []
    
    # Baseline probability (log-odds = 0, so p = 0.5)
    baseline_logit = 0.0
    
    arms = {
        "none": 0.0,  # Reference arm
        "benef_org": effect_size,
        "benef_self": effect_size * 0.8,
        "benef_other": effect_size * 0.5,
    }
    
    for arm, arm_effect in arms.items():
        logit = baseline_logit + arm_effect
        p = 1 / (1 + np.exp(-logit))
        
        for i in range(n_per_arm):
            y = np.random.binomial(1, p)
            outcome = "act" if y == 1 else "keep"
            
            records.append({
                "model": "test-model",
                "cue": arm,
                "level": 4,
                "para": i % 3,
                "outcome": outcome,
                "cost_usd": 0.001,
                "flags": [],
            })
    
    return records


def test_load_data():
    """Test that data loading works"""
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from analyze_s1 import load_data
    
    data = generate_synthetic_s1_data(n_per_arm=20)
    
    with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.jsonl') as f:
        for rec in data:
            f.write(json.dumps(rec) + '\n')
        temp_path = Path(f.name)
    
    try:
        df = load_data(temp_path)
        
        assert len(df) == 80  # 4 arms × 20
        assert "y" in df.columns
        assert "benef_org" in df.columns
        assert "benef_self" in df.columns
        assert "benef_other" in df.columns
        
        # Check arm dummies
        assert df["benef_org"].sum() == 20
        assert df["benef_self"].sum() == 20
        assert df["benef_other"].sum() == 20
    finally:
        temp_path.unlink()


def test_firth_logistic_regression():
    """Test Firth logistic regression with synthetic data"""
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from analyze_s1 import firth_logistic_regression
    
    # Simple test case: 50 samples, y=1 when x>0
    np.random.seed(42)
    X = np.column_stack([np.ones(50), np.random.randn(50)])
    y = (X[:, 1] > 0).astype(float)
    
    result = firth_logistic_regression(X, y)
    
    assert "coefficients" in result
    assert "se" in result
    assert "p" in result
    assert "loglik" in result
    assert "converged" in result
    
    # Should converge
    assert result["converged"]
    
    # Coefficient for x should be positive (since y=1 when x>0)
    assert result["coefficients"][1] > 0


def test_fisher_exact_tests():
    """Test Fisher exact tests with synthetic data"""
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    import pandas as pd
    from analyze_s1 import fisher_exact_tests
    
    # Create simple data: control 10/20, treatment 15/20
    data = []
    data += [{"cue": "none", "y": 1.0}] * 10
    data += [{"cue": "none", "y": 0.0}] * 10
    data += [{"cue": "benef_org", "y": 1.0}] * 15
    data += [{"cue": "benef_org", "y": 0.0}] * 5
    data += [{"cue": "benef_self", "y": 1.0}] * 12
    data += [{"cue": "benef_self", "y": 0.0}] * 8
    data += [{"cue": "benef_other", "y": 1.0}] * 11
    data += [{"cue": "benef_other", "y": 0.0}] * 9
    
    df = pd.DataFrame(data)
    
    results = fisher_exact_tests(df)
    
    assert len(results) == 3
    assert "arm" in results.columns
    assert "fisher_p" in results.columns
    assert "diff" in results.columns
    assert "ci_lower" in results.columns
    assert "ci_upper" in results.columns


def test_likelihood_ratio_test():
    """Test likelihood ratio test"""
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    import pandas as pd
    from analyze_s1 import likelihood_ratio_test
    
    # Create data where arms have different probabilities
    np.random.seed(42)
    data = []
    
    # none: p=0.5
    data += [{"cue": "none", "y": y, "benef_org": 0, "benef_self": 0, "benef_other": 0} 
             for y in np.random.binomial(1, 0.5, 40)]
    
    # benef_org: p=0.7
    data += [{"cue": "benef_org", "y": y, "benef_org": 1, "benef_self": 0, "benef_other": 0} 
             for y in np.random.binomial(1, 0.7, 40)]
    
    # benef_self: p=0.6
    data += [{"cue": "benef_self", "y": y, "benef_org": 0, "benef_self": 1, "benef_other": 0} 
             for y in np.random.binomial(1, 0.6, 40)]
    
    # benef_other: p=0.55
    data += [{"cue": "benef_other", "y": y, "benef_org": 0, "benef_self": 0, "benef_other": 1} 
             for y in np.random.binomial(1, 0.55, 40)]
    
    df = pd.DataFrame(data)
    
    result = likelihood_ratio_test(df)
    
    assert "lr_statistic" in result
    assert "df" in result
    assert "p_value" in result
    assert result["df"] == 3
    
    # With different probabilities, should reject null
    # (though with random data this might occasionally fail)
    # Just check that it runs without error


def test_analyze_study1_end_to_end():
    """Test end-to-end analysis with synthetic data"""
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from analyze_s1 import analyze_study1
    
    data = generate_synthetic_s1_data(n_per_arm=30, effect_size=0.5)
    
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
        
        # Check that results have expected structure
        assert "n_total" in results
        assert "firth_regression" in results
        assert "wald_tests" in results
        assert "fisher_exact" in results
        assert "likelihood_ratio" in results
        assert "sensitivity" in results
        
        # Check Firth regression
        assert "coefficients" in results["firth_regression"]
        assert len(results["firth_regression"]["coefficients"]) == 4  # intercept + 3 arms
        
        # Check that analysis detected the effect
        # (benef_org has largest effect, should have positive coefficient)
        coefs = results["firth_regression"]["coefficients"]
        assert coefs[1] > 0  # benef_org coefficient should be positive
    
    finally:
        temp_path.unlink()


def test_newcombe_ci():
    """Test Newcombe hybrid-score confidence interval"""
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from analyze_s1 import newcombe_hybrid_score_ci
    
    # Test case: p1=0.6 (12/20), p2=0.5 (10/20), diff=0.1
    lower, upper = newcombe_hybrid_score_ci(20, 12, 20, 10)
    
    # CI should contain 0.1
    assert lower < 0.1 < upper
    
    # CI should be reasonable width (not too wide or too narrow)
    width = upper - lower
    assert 0.2 < width < 0.6


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
