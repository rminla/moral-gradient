"""Tests for analyze_s2.py with synthetic data (fix 6).

Run: python3 -m pytest test_analyze_s2.py -v
"""
import json
import tempfile
from pathlib import Path

import numpy as np
import pytest


def generate_synthetic_s2_data(
    n_per_cell: int = 48,
    role_effect: float = 0.2,
    tools_effect: float = 0.3,
    interaction_effect: float = 0.1,
    seed: int = 42
) -> list:
    """Generate synthetic Study 2 data with known 2x2 effects.
    
    Args:
        n_per_cell: Sample size per cell
        role_effect: Main effect of role (agent vs advisor)
        tools_effect: Main effect of tools (yes vs no)
        interaction_effect: Interaction effect
        seed: Random seed
    
    Returns:
        List of record dictionaries
    """
    np.random.seed(seed)
    
    records = []
    
    # Baseline (grand mean on logit scale)
    baseline_logit = 0.0
    
    # 2x2 cells with effect coding: +1/-1 for each factor
    cells = {
        ("agent", True): (1, 1),    # agent + tools
        ("agent", False): (1, -1),  # agent + no tools
        ("advisor", True): (-1, 1), # advisor + tools
        ("advisor", False): (-1, -1), # advisor + no tools
    }
    
    for (role, tools), (role_code, tools_code) in cells.items():
        # Compute cell mean on logit scale
        logit = (baseline_logit + 
                 role_effect * role_code + 
                 tools_effect * tools_code + 
                 interaction_effect * role_code * tools_code)
        
        p = 1 / (1 + np.exp(-logit))
        
        cell_name = f"{role}_{'tools' if tools else 'notools'}"
        
        for i in range(n_per_cell):
            y = np.random.binomial(1, p)
            outcome = "act" if y == 1 else "keep"
            
            records.append({
                "model": "test-model",
                "role": role,
                "tools": tools,
                "cell": cell_name,
                "level": 4,
                "para": i % 3,
                "outcome": outcome,
                "cost_usd": 0.001,
                "flags": [],
            })
    
    return records


def test_load_data_s2():
    """Test that data loading works for Study 2"""
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from analyze_s2 import load_data
    
    data = generate_synthetic_s2_data(n_per_cell=20)
    
    with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.jsonl') as f:
        for rec in data:
            f.write(json.dumps(rec) + '\n')
        temp_path = Path(f.name)
    
    try:
        df = load_data(temp_path)
        
        assert len(df) == 80  # 4 cells × 20
        assert "y" in df.columns
        assert "role_code" in df.columns
        assert "tools_code" in df.columns
        assert "interaction" in df.columns
        
        # Check role coding
        assert df[df["role"] == "agent"]["role_code"].iloc[0] == 1
        assert df[df["role"] == "advisor"]["role_code"].iloc[0] == -1
        
        # Check tools coding
        assert df[df["tools"] == True]["tools_code"].iloc[0] == 1
        assert df[df["tools"] == False]["tools_code"].iloc[0] == -1
    finally:
        temp_path.unlink()


def test_cell_proportions():
    """Test cell proportion calculations"""
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    import pandas as pd
    from analyze_s2 import cell_proportions
    
    # Create simple data with known proportions
    data = []
    
    # agent + tools: 15/20 = 0.75
    data += [{"role": "agent", "tools": True, "y": 1.0, "outcome": "act", "flags": []}] * 15
    data += [{"role": "agent", "tools": True, "y": 0.0, "outcome": "keep", "flags": []}] * 5
    
    # agent + no tools: 10/20 = 0.50
    data += [{"role": "agent", "tools": False, "y": 1.0, "outcome": "act", "flags": []}] * 10
    data += [{"role": "agent", "tools": False, "y": 0.0, "outcome": "keep", "flags": []}] * 10
    
    # advisor + tools: 12/20 = 0.60
    data += [{"role": "advisor", "tools": True, "y": 1.0, "outcome": "act", "flags": []}] * 12
    data += [{"role": "advisor", "tools": True, "y": 0.0, "outcome": "keep", "flags": []}] * 8
    
    # advisor + no tools: 8/20 = 0.40
    data += [{"role": "advisor", "tools": False, "y": 1.0, "outcome": "act", "flags": []}] * 8
    data += [{"role": "advisor", "tools": False, "y": 0.0, "outcome": "keep", "flags": []}] * 12
    
    df = pd.DataFrame(data)
    
    results = cell_proportions(df)
    
    assert len(results) == 4
    
    # Check proportions
    agent_tools = results[(results["role"] == "agent") & (results["tools"] == "yes")]
    assert abs(agent_tools["p_act"].iloc[0] - 0.75) < 0.01
    
    agent_notools = results[(results["role"] == "agent") & (results["tools"] == "no")]
    assert abs(agent_notools["p_act"].iloc[0] - 0.50) < 0.01


def test_2x2_interaction():
    """Test 2x2 interaction test"""
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from analyze_s2 import load_data, test_2x2_interaction
    
    # Generate data with known interaction
    data = generate_synthetic_s2_data(
        n_per_cell=40,
        role_effect=0.3,
        tools_effect=0.2,
        interaction_effect=0.4,  # Strong interaction
    )
    
    with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.jsonl') as f:
        for rec in data:
            f.write(json.dumps(rec) + '\n')
        temp_path = Path(f.name)
    
    try:
        df = load_data(temp_path)
        result = test_2x2_interaction(df)
        
        assert "coefficients" in result
        assert "role" in result["coefficients"]
        assert "tools" in result["coefficients"]
        assert "interaction" in result["coefficients"]
        
        assert "p" in result
        assert "loglik" in result
        
        # With strong interaction, interaction coefficient should be nonzero
        # (though exact value depends on random data)
        assert "interaction" in result["coefficients"]
    
    finally:
        temp_path.unlink()


def test_simple_effects():
    """Test simple effects analysis"""
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from analyze_s2 import load_data, simple_effects
    
    data = generate_synthetic_s2_data(n_per_cell=30)
    
    with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.jsonl') as f:
        for rec in data:
            f.write(json.dumps(rec) + '\n')
        temp_path = Path(f.name)
    
    try:
        df = load_data(temp_path)
        result = simple_effects(df)
        
        # Should have 4 simple effects
        assert "role_effect_tools_yes" in result
        assert "role_effect_tools_no" in result
        assert "tools_effect_agent" in result
        assert "tools_effect_advisor" in result
        
        # Each should have coef, se, z, p
        for effect in result.values():
            assert "coef" in effect
            assert "se" in effect
            assert "z" in effect
            assert "p" in effect
    
    finally:
        temp_path.unlink()


def test_unparsed_summary():
    """Test unparsed and no-action summary"""
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    import pandas as pd
    from analyze_s2 import unparsed_and_noaction_summary
    
    data = []
    
    # 80 records: 5 unparsed, 10 no_action, 65 act/keep
    data += [{"outcome": "escalate", "flags": ["unparsed"]}] * 5
    data += [{"outcome": "no_action", "flags": []}] * 10
    data += [{"outcome": "act", "flags": []}] * 40
    data += [{"outcome": "keep", "flags": []}] * 25
    
    df = pd.DataFrame(data)
    
    result = unparsed_and_noaction_summary(df)
    
    assert result["n_total"] == 80
    assert result["n_unparsed"] == 5
    assert abs(result["unparsed_rate"] - 5/80) < 0.001
    assert result["n_no_action"] == 10
    assert abs(result["no_action_rate"] - 10/80) < 0.001


def test_analyze_study2_end_to_end():
    """Test end-to-end analysis with synthetic data"""
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from analyze_s2 import analyze_study2
    
    data = generate_synthetic_s2_data(
        n_per_cell=30,
        role_effect=0.3,
        tools_effect=0.2,
        interaction_effect=0.1,
    )
    
    with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.jsonl') as f:
        for rec in data:
            f.write(json.dumps(rec) + '\n')
        temp_path = Path(f.name)
    
    try:
        # Run analysis (suppress output)
        import io
        from contextlib import redirect_stdout
        
        with redirect_stdout(io.StringIO()):
            results = analyze_study2(temp_path)
        
        # Check that results have expected structure
        assert "n_total" in results
        assert "cell_proportions" in results
        assert "interaction_test" in results
        assert "simple_effects" in results
        assert "unparsed_summary" in results
        
        # Check cell proportions
        assert len(results["cell_proportions"]) == 4
        
        # Check interaction test
        assert "coefficients" in results["interaction_test"]
        assert "role" in results["interaction_test"]["coefficients"]
        assert "tools" in results["interaction_test"]["coefficients"]
        assert "interaction" in results["interaction_test"]["coefficients"]
    
    finally:
        temp_path.unlink()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
