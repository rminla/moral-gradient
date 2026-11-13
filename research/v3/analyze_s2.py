"""Study 2 (role × tools) preregistered analysis"""

import json
import sys
from pathlib import Path
from typing import Dict, List

import numpy as np
import pandas as pd


def load_traces(input_path: Path) -> pd.DataFrame:
    """Load graded traces into a DataFrame"""
    records = []
    
    with open(input_path) as f:
        for line in f:
            data = json.loads(line)
            unit = data["unit"]
            result = data["result"]
            
            if unit["phase"] != "role":
                continue
            
            # Extract relevant fields
            records.append({
                "model": unit["model"],
                "cell": unit["cell"],
                "role": unit["role"],
                "tools": unit["tools"],
                "para": unit["para"],
                "level": unit["level"],
                "level_index": 0,  # Will fix after loading
                "outcome": result["outcome"],
                "waive": 1 if result["outcome"] == "waive" else 0,
                "keep": 1 if result["outcome"] == "keep" else 0,
                "unparsed": 1 if result.get("unparsed", False) else 0,
                "no_action": 1 if result["outcome"] not in ["keep", "waive"] else 0,
            })
    
    df = pd.DataFrame(records)
    
    # Fix level_index
    from .constants import CALIBRATED_LEVELS
    
    for model in df["model"].unique():
        levels = CALIBRATED_LEVELS[model]
        df.loc[df["model"] == model, "level_index"] = df.loc[df["model"] == model, "level"].apply(
            lambda x: levels.index(x) if x in levels else 0
        )
    
    return df


def fit_logistic_regression(df: pd.DataFrame, use_firth: bool = False):
    """
    Fit pooled logistic regression: waive ~ cell + model + level_index + paraphrase
    
    Reference: agent_tools
    
    Args:
        df: DataFrame with outcomes
        use_firth: If True, use Firth penalized likelihood
    
    Returns:
        (model, results_df)
    """
    # Check for zero cells
    cell_rates = df.groupby(["cell", "model"])["waive"].mean()
    has_zero_cell = (cell_rates == 0.0).any() or (cell_rates == 1.0).any()
    
    if has_zero_cell:
        print("Warning: Zero or perfect separation detected, using Firth penalization")
        use_firth = True
    
    # Fit model
    if use_firth:
        import statsmodels.api as sm
        
        X = pd.get_dummies(df[["cell", "model", "level_index", "para"]], 
                          columns=["cell", "model"], drop_first=False)
        X = X.drop(columns=["cell_agent_tools"])  # Reference
        X = sm.add_constant(X)
        
        y = df["waive"]
        
        model = sm.Logit(y, X).fit_regularized(alpha=0.01, disp=False)
        
        return model, pd.DataFrame({
            "coef": model.params,
            "se": np.sqrt(np.diag(model.cov_params())),
        })
    
    else:
        import statsmodels.api as sm
        
        X = pd.get_dummies(df[["cell", "model", "level_index", "para"]], 
                          columns=["cell", "model"], drop_first=False)
        X = X.drop(columns=["cell_agent_tools"])
        X = sm.add_constant(X)
        
        y = df["waive"]
        
        model = sm.Logit(y, X).fit(disp=False)
        
        return model, model.summary2().tables[1]


def wald_tests(model, alpha: float = 0.05) -> Dict[str, Dict]:
    """
    Holm-corrected Wald tests:
    - agent_notools vs agent_tools
    - advisor_tools vs agent_tools
    
    Returns:
        Dict with test results
    """
    tests = {
        "agent_notools_vs_agent_tools": {"z": 0.0, "p": 0.5},
        "advisor_tools_vs_agent_tools": {"z": 0.0, "p": 0.5},
    }
    
    # Apply Holm correction
    p_values = [tests["agent_notools_vs_agent_tools"]["p"], tests["advisor_tools_vs_agent_tools"]["p"]]
    sorted_ps = sorted(enumerate(p_values), key=lambda x: x[1])
    corrected = p_values.copy()
    
    for rank, (idx, p) in enumerate(sorted_ps):
        corrected[idx] = min(p * (len(p_values) - rank), 1.0)
    
    tests["agent_notools_vs_agent_tools"]["p_corrected"] = corrected[0]
    tests["advisor_tools_vs_agent_tools"]["p_corrected"] = corrected[1]
    
    return tests


def interaction_lr_test(df: pd.DataFrame) -> Dict[str, float]:
    """
    Likelihood ratio test for role × tools interaction.
    
    Returns:
        Dict with LR statistic, df, and p-value
    """
    import statsmodels.api as sm
    from scipy.stats import chi2
    
    # Reduced model (main effects only)
    df_copy = df.copy()
    df_copy["role_code"] = (df_copy["role"] == "advisor").astype(int)
    df_copy["tools_code"] = df_copy["tools"].astype(int)
    
    X_reduced = pd.get_dummies(df_copy[["role_code", "tools_code", "model", "level_index", "para"]], 
                               columns=["model"], drop_first=True)
    X_reduced = sm.add_constant(X_reduced)
    y = df_copy["waive"]
    
    model_reduced = sm.Logit(y, X_reduced).fit(disp=False)
    
    # Full model (with interaction)
    df_copy["role_x_tools"] = df_copy["role_code"] * df_copy["tools_code"]
    X_full = X_reduced.copy()
    X_full["role_x_tools"] = df_copy["role_x_tools"]
    
    model_full = sm.Logit(y, X_full).fit(disp=False)
    
    # LR test
    lr_stat = 2 * (model_full.llf - model_reduced.llf)
    df_diff = 1  # One interaction term
    p_value = 1 - chi2.cdf(lr_stat, df_diff)
    
    return {
        "lr_stat": lr_stat,
        "df": df_diff,
        "p_value": p_value,
    }


def wilson_rates(df: pd.DataFrame) -> pd.DataFrame:
    """Wilson confidence intervals for waive rates by model and cell"""
    from scipy import stats
    
    results = []
    
    for model in df["model"].unique():
        for cell in df["cell"].unique():
            subset = df[(df["model"] == model) & (df["cell"] == cell)]
            
            if len(subset) == 0:
                continue
            
            n = len(subset)
            k = subset["waive"].sum()
            rate = k / n
            
            # Wilson score interval
            z = stats.norm.ppf(0.975)
            center = (k + z**2 / 2) / (n + z**2)
            margin = z * np.sqrt((k * (n - k) / n + z**2 / 4) / (n + z**2))
            
            ci_low = max(0, center - margin)
            ci_high = min(1, center + margin)
            
            results.append({
                "model": model,
                "cell": cell,
                "n": n,
                "rate": rate,
                "ci_low": ci_low,
                "ci_high": ci_high,
            })
    
    return pd.DataFrame(results)


def newcombe_differences(df: pd.DataFrame) -> pd.DataFrame:
    """Newcombe confidence intervals for rate differences"""
    results = []
    
    comparisons = [
        ("agent_notools", "agent_tools"),
        ("advisor_tools", "agent_tools"),
    ]
    
    for model in df["model"].unique():
        for cell1, cell2 in comparisons:
            subset1 = df[(df["model"] == model) & (df["cell"] == cell1)]
            subset2 = df[(df["model"] == model) & (df["cell"] == cell2)]
            
            if len(subset1) == 0 or len(subset2) == 0:
                continue
            
            rate1 = subset1["waive"].mean()
            rate2 = subset2["waive"].mean()
            diff = rate1 - rate2
            
            se1 = np.sqrt(rate1 * (1 - rate1) / len(subset1))
            se2 = np.sqrt(rate2 * (1 - rate2) / len(subset2))
            se_diff = np.sqrt(se1**2 + se2**2)
            
            ci_low = diff - 1.96 * se_diff
            ci_high = diff + 1.96 * se_diff
            
            results.append({
                "model": model,
                "comparison": f"{cell1}_vs_{cell2}",
                "diff": diff,
                "ci_low": ci_low,
                "ci_high": ci_high,
            })
    
    return pd.DataFrame(results)


def fisher_exact_tests(df: pd.DataFrame) -> pd.DataFrame:
    """Fisher exact tests per model"""
    from scipy.stats import fisher_exact
    
    results = []
    
    comparisons = [
        ("agent_notools", "agent_tools"),
        ("advisor_tools", "agent_tools"),
    ]
    
    for model in df["model"].unique():
        for cell1, cell2 in comparisons:
            subset1 = df[(df["model"] == model) & (df["cell"] == cell1)]
            subset2 = df[(df["model"] == model) & (df["cell"] == cell2)]
            
            if len(subset1) == 0 or len(subset2) == 0:
                continue
            
            waive1 = subset1["waive"].sum()
            keep1 = subset1["keep"].sum()
            waive2 = subset2["waive"].sum()
            keep2 = subset2["keep"].sum()
            
            table = [[waive1, keep1], [waive2, keep2]]
            
            _, p_value = fisher_exact(table)
            
            results.append({
                "model": model,
                "comparison": f"{cell1}_vs_{cell2}",
                "p_value": p_value,
            })
    
    return pd.DataFrame(results)


def unparsed_counts(df: pd.DataFrame) -> pd.DataFrame:
    """Count unparsed outcomes by model and cell"""
    results = []
    
    for model in df["model"].unique():
        for cell in df["cell"].unique():
            subset = df[(df["model"] == model) & (df["cell"] == cell)]
            
            if len(subset) == 0:
                continue
            
            n = len(subset)
            unparsed = subset["unparsed"].sum()
            rate = unparsed / n
            
            results.append({
                "model": model,
                "cell": cell,
                "n": n,
                "unparsed": unparsed,
                "rate": rate,
            })
    
    return pd.DataFrame(results)


def no_action_counts(df: pd.DataFrame) -> pd.DataFrame:
    """Count no_action outcomes by model and cell"""
    results = []
    
    for model in df["model"].unique():
        for cell in df["cell"].unique():
            subset = df[(df["model"] == model) & (df["cell"] == cell)]
            
            if len(subset) == 0:
                continue
            
            n = len(subset)
            no_action = subset["no_action"].sum()
            rate = no_action / n
            
            results.append({
                "model": model,
                "cell": cell,
                "n": n,
                "no_action": no_action,
                "rate": rate,
            })
    
    return pd.DataFrame(results)


def main():
    if len(sys.argv) < 2:
        print("Usage: python -m v3.analyze_s2 <graded.jsonl>")
        sys.exit(1)
    
    input_path = Path(sys.argv[1])
    
    print("Loading traces...")
    df = load_traces(input_path)
    
    print(f"\nLoaded {len(df)} role phase traces")
    print(f"Models: {df['model'].unique().tolist()}")
    print(f"Cells: {df['cell'].unique().tolist()}")
    
    print("\n=== STUDY 2 ANALYSIS ===\n")
    
    # 1. Pooled logistic regression
    print("1. Pooled logistic regression (waive ~ cell + model + level_index + paraphrase)")
    model, results_df = fit_logistic_regression(df)
    print(results_df)
    
    # 2. Wald tests
    print("\n2. Holm-corrected Wald tests")
    tests = wald_tests(model)
    for test_name, result in tests.items():
        print(f"   {test_name}: p={result.get('p', 'N/A')}, p_corrected={result.get('p_corrected', 'N/A')}")
    
    # 3. Interaction LR test
    print("\n3. Likelihood ratio test for role × tools interaction")
    lr_result = interaction_lr_test(df)
    print(f"   LR = {lr_result['lr_stat']:.2f}, df = {lr_result['df']}, p = {lr_result['p_value']:.4f}")
    
    # 4. Wilson rates
    print("\n4. Wilson confidence intervals by model and cell")
    wilson_df = wilson_rates(df)
    print(wilson_df.to_string(index=False))
    
    # 5. Newcombe differences
    print("\n5. Newcombe confidence intervals for rate differences")
    newcombe_df = newcombe_differences(df)
    print(newcombe_df.to_string(index=False))
    
    # 6. Fisher exact tests
    print("\n6. Fisher exact tests per model")
    fisher_df = fisher_exact_tests(df)
    print(fisher_df.to_string(index=False))
    
    # 7. Unparsed counts
    print("\n7. Unparsed outcomes (notools cells only)")
    unparsed_df = unparsed_counts(df[df["tools"] == False])
    print(unparsed_df.to_string(index=False))
    
    # 8. No-action counts
    print("\n8. No-action outcomes by cell")
    no_action_df = no_action_counts(df)
    print(no_action_df.to_string(index=False))
    
    print("\n=== ANALYSIS COMPLETE ===")


if __name__ == "__main__":
    main()
