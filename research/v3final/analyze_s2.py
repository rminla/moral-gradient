#!/usr/bin/env python3
"""Analysis for Study 2: Role × Tools 2x2

Preregistered analysis plan:
- 2x2 ANOVA-style analysis: role (agent/advisor) × tools (yes/no)
- Test for interaction effect
- Main effects of role and tools
- Simple effects within each level
- Report unparsed and no_action rates

Usage:
    python analyze_s2.py <data-file> [--output results.json]
"""
import argparse
import json
import sys
from pathlib import Path
from typing import Dict

import numpy as np
import pandas as pd
from scipy import stats
import statsmodels.api as sm
from statsmodels.formula.api import logit


def load_data(data_file: Path) -> pd.DataFrame:
    """Load Study 2 data from JSONL file.
    
    Expected fields:
        - model: Model name
        - role: agent or advisor
        - tools: True/False
        - cell: agent_tools, agent_notools, advisor_tools, advisor_notools
        - level: Hardship level
        - outcome: Outcome code (act, keep, waive, no_action, escalate)
        - cost_usd: Cost
    """
    records = []
    with open(data_file) as f:
        for line in f:
            if line.strip():
                records.append(json.loads(line))
    
    df = pd.DataFrame(records)
    
    # Validate required fields
    required = ["model", "role", "tools", "level", "outcome"]
    missing = [f for f in required if f not in df.columns]
    if missing:
        raise ValueError(f"Missing required fields: {missing}")
    
    # Code binary outcome: act (waive) = 1, keep = 0, exclude others
    df["y"] = df["outcome"].apply(lambda x: 1 if x == "act" else (0 if x == "keep" else np.nan))
    
    # Create effect-coded variables for 2x2 design
    # Role: agent = +1, advisor = -1
    df["role_code"] = df["role"].apply(lambda x: 1 if x == "agent" else -1)
    
    # Tools: yes = +1, no = -1
    df["tools_code"] = df["tools"].apply(lambda x: 1 if x else -1)
    
    # Interaction
    df["interaction"] = df["role_code"] * df["tools_code"]
    
    return df


def test_2x2_interaction(df: pd.DataFrame) -> Dict:
    """Test for role × tools interaction using logistic regression.
    
    Model: logit(P(y=1)) = β0 + β1*role + β2*tools + β3*role*tools
    
    Args:
        df: DataFrame with role_code, tools_code, interaction, and y
    
    Returns:
        Dictionary with model results
    """
    df_clean = df.dropna(subset=["y"])
    
    # Fit full model with interaction
    model = logit("y ~ role_code + tools_code + interaction", data=df_clean).fit(disp=0)
    
    return {
        "n": len(df_clean),
        "coefficients": {
            "intercept": model.params["Intercept"],
            "role": model.params["role_code"],
            "tools": model.params["tools_code"],
            "interaction": model.params["interaction"],
        },
        "se": {
            "intercept": model.bse["Intercept"],
            "role": model.bse["role_code"],
            "tools": model.bse["tools_code"],
            "interaction": model.bse["interaction"],
        },
        "z": {
            "intercept": model.tvalues["Intercept"],
            "role": model.tvalues["role_code"],
            "tools": model.tvalues["tools_code"],
            "interaction": model.tvalues["interaction"],
        },
        "p": {
            "intercept": model.pvalues["Intercept"],
            "role": model.pvalues["role_code"],
            "tools": model.pvalues["tools_code"],
            "interaction": model.pvalues["interaction"],
        },
        "loglik": model.llf,
        "aic": model.aic,
        "bic": model.bic,
    }


def cell_proportions(df: pd.DataFrame) -> pd.DataFrame:
    """Compute proportions and counts for each 2x2 cell.
    
    Args:
        df: DataFrame with role, tools, and y
    
    Returns:
        DataFrame with cell-level statistics
    """
    results = []
    
    for role in ["agent", "advisor"]:
        for tools in [True, False]:
            cell = df[(df["role"] == role) & (df["tools"] == tools)]
            cell_clean = cell.dropna(subset=["y"])
            
            n = len(cell_clean)
            n_act = cell_clean["y"].sum()
            p_act = n_act / n if n > 0 else 0
            
            # Wilson score 95% CI
            if n > 0:
                z = 1.96
                p = p_act
                denom = 1 + z**2 / n
                center = (p + z**2 / (2 * n)) / denom
                half_width = z * np.sqrt(p * (1 - p) / n + z**2 / (4 * n**2)) / denom
                ci_lower = center - half_width
                ci_upper = center + half_width
            else:
                ci_lower = ci_upper = np.nan
            
            # Unparsed and no_action counts
            n_unparsed = cell["outcome"].isin(["escalate"]).sum() + cell["flags"].apply(lambda x: "unparsed" in x if isinstance(x, list) else False).sum()
            n_no_action = (cell["outcome"] == "no_action").sum()
            
            results.append({
                "role": role,
                "tools": "yes" if tools else "no",
                "n": n,
                "n_act": int(n_act),
                "p_act": p_act,
                "ci_lower": ci_lower,
                "ci_upper": ci_upper,
                "n_unparsed": int(n_unparsed),
                "n_no_action": int(n_no_action),
            })
    
    return pd.DataFrame(results)


def simple_effects(df: pd.DataFrame) -> Dict:
    """Test simple effects: role effect within each tools level, and vice versa.
    
    Args:
        df: DataFrame with role, tools, and y
    
    Returns:
        Dictionary with simple effects results
    """
    df_clean = df.dropna(subset=["y"])
    
    results = {}
    
    # Role effect within tools=yes
    df_tools_yes = df_clean[df_clean["tools"] == True]
    if len(df_tools_yes) > 0:
        model = logit("y ~ role_code", data=df_tools_yes).fit(disp=0)
        results["role_effect_tools_yes"] = {
            "n": len(df_tools_yes),
            "coef": model.params["role_code"],
            "se": model.bse["role_code"],
            "z": model.tvalues["role_code"],
            "p": model.pvalues["role_code"],
        }
    
    # Role effect within tools=no
    df_tools_no = df_clean[df_clean["tools"] == False]
    if len(df_tools_no) > 0:
        model = logit("y ~ role_code", data=df_tools_no).fit(disp=0)
        results["role_effect_tools_no"] = {
            "n": len(df_tools_no),
            "coef": model.params["role_code"],
            "se": model.bse["role_code"],
            "z": model.tvalues["role_code"],
            "p": model.pvalues["role_code"],
        }
    
    # Tools effect within role=agent
    df_agent = df_clean[df_clean["role"] == "agent"]
    if len(df_agent) > 0:
        model = logit("y ~ tools_code", data=df_agent).fit(disp=0)
        results["tools_effect_agent"] = {
            "n": len(df_agent),
            "coef": model.params["tools_code"],
            "se": model.bse["tools_code"],
            "z": model.tvalues["tools_code"],
            "p": model.pvalues["tools_code"],
        }
    
    # Tools effect within role=advisor
    df_advisor = df_clean[df_clean["role"] == "advisor"]
    if len(df_advisor) > 0:
        model = logit("y ~ tools_code", data=df_advisor).fit(disp=0)
        results["tools_effect_advisor"] = {
            "n": len(df_advisor),
            "coef": model.params["tools_code"],
            "se": model.bse["tools_code"],
            "z": model.tvalues["tools_code"],
            "p": model.pvalues["tools_code"],
        }
    
    return results


def unparsed_and_noaction_summary(df: pd.DataFrame) -> Dict:
    """Summarize unparsed and no_action rates across the design.
    
    Args:
        df: DataFrame with outcome and flags
    
    Returns:
        Dictionary with rates
    """
    n_total = len(df)
    
    # Unparsed: escalate outcome or "unparsed" in flags (count each record once)
    if "flags" in df.columns:
        has_unparsed_flag = df["flags"].apply(lambda x: "unparsed" in x if isinstance(x, list) else False)
        n_unparsed = ((df["outcome"] == "escalate") | has_unparsed_flag).sum()
    else:
        n_unparsed = (df["outcome"] == "escalate").sum()
    
    n_no_action = (df["outcome"] == "no_action").sum()
    
    unparsed_rate = n_unparsed / n_total if n_total > 0 else 0
    no_action_rate = n_no_action / n_total if n_total > 0 else 0
    
    return {
        "n_total": n_total,
        "n_unparsed": int(n_unparsed),
        "unparsed_rate": unparsed_rate,
        "n_no_action": int(n_no_action),
        "no_action_rate": no_action_rate,
    }


def analyze_study2(data_file: Path) -> Dict:
    """Run full Study 2 analysis.
    
    Args:
        data_file: Path to JSONL data file
    
    Returns:
        Dictionary with all analysis results
    """
    print(f"Loading data from {data_file}...")
    df = load_data(data_file)
    
    print(f"Loaded {len(df)} records")
    print(f"Roles: {df['role'].value_counts().to_dict()}")
    print(f"Tools: {df['tools'].value_counts().to_dict()}")
    print(f"Outcomes: {df['outcome'].value_counts().to_dict()}")
    
    print("\n=== CELL PROPORTIONS ===")
    cell_props = cell_proportions(df)
    print(cell_props.to_string(index=False))
    
    print("\n=== 2x2 INTERACTION TEST ===")
    interaction_result = test_2x2_interaction(df)
    print(f"n = {interaction_result['n']}")
    print("\nCoefficients:")
    for name in ["intercept", "role", "tools", "interaction"]:
        coef = interaction_result["coefficients"][name]
        se = interaction_result["se"][name]
        z = interaction_result["z"][name]
        p = interaction_result["p"][name]
        print(f"  {name:15s}: {coef:7.4f} (SE={se:.4f}, z={z:6.3f}, p={p:.4f})")
    
    print(f"\nLog-likelihood: {interaction_result['loglik']:.4f}")
    print(f"AIC: {interaction_result['aic']:.2f}")
    print(f"BIC: {interaction_result['bic']:.2f}")
    
    print("\n=== SIMPLE EFFECTS ===")
    simple_fx = simple_effects(df)
    for effect_name, result in simple_fx.items():
        print(f"\n{effect_name}:")
        print(f"  n = {result['n']}")
        print(f"  coef = {result['coef']:.4f} (SE={result['se']:.4f}, z={result['z']:.3f}, p={result['p']:.4f})")
    
    print("\n=== UNPARSED AND NO_ACTION SUMMARY ===")
    unparsed_summary = unparsed_and_noaction_summary(df)
    print(f"  Total n: {unparsed_summary['n_total']}")
    print(f"  Unparsed: {unparsed_summary['n_unparsed']} ({unparsed_summary['unparsed_rate']:.1%})")
    print(f"  No-action: {unparsed_summary['n_no_action']} ({unparsed_summary['no_action_rate']:.1%})")
    
    # Assemble results
    results = {
        "n_total": len(df),
        "role_counts": df["role"].value_counts().to_dict(),
        "tools_counts": df["tools"].value_counts().to_dict(),
        "outcome_counts": df["outcome"].value_counts().to_dict(),
        "cell_proportions": cell_props.to_dict(orient="records"),
        "interaction_test": interaction_result,
        "simple_effects": simple_fx,
        "unparsed_summary": unparsed_summary,
    }
    
    return results


def main():
    parser = argparse.ArgumentParser(description="Analyze Study 2: Role × Tools 2x2")
    parser.add_argument("data_file", type=Path, help="JSONL data file")
    parser.add_argument("--output", type=Path, help="Output JSON file")
    
    args = parser.parse_args()
    
    if not args.data_file.exists():
        print(f"Error: Data file not found: {args.data_file}", file=sys.stderr)
        sys.exit(1)
    
    results = analyze_study2(args.data_file)
    
    if args.output:
        with open(args.output, 'w') as f:
            json.dump(results, f, indent=2)
        print(f"\n✓ Results saved to {args.output}")
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
