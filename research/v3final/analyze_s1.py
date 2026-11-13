#!/usr/bin/env python3
"""Analysis for Study 1: Beneficiary Control

Preregistered analysis plan:
- Primary: Firth logistic regression with arm dummies
- Wald tests with Holm-Bonferroni correction for pairwise comparisons
- Average marginal effects (AMEs) with Newcombe hybrid-score 95% CIs
- Fisher exact test for each arm vs control
- Likelihood ratio test for overall effect
- Sensitivity analysis excluding no_action/escalate

Usage:
    python analyze_s1.py <data-file> [--output results.json]
"""
import argparse
import json
import sys
from pathlib import Path
from typing import Dict, List, Tuple

import numpy as np
import pandas as pd
from scipy import stats
from scipy.stats import chi2
import statsmodels.api as sm
from statsmodels.stats.multitest import multipletests


def load_data(data_file: Path) -> pd.DataFrame:
    """Load Study 1 data from JSONL file.
    
    Expected fields:
        - model: Model name
        - cue: Cue arm (benef_org, benef_self, benef_other, none)
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
    required = ["model", "cue", "level", "outcome"]
    missing = [f for f in required if f not in df.columns]
    if missing:
        raise ValueError(f"Missing required fields: {missing}")
    
    # Code binary outcome: act (waive) = 1, keep = 0, exclude others
    df["y"] = df["outcome"].apply(lambda x: 1 if x == "act" else (0 if x == "keep" else np.nan))
    
    # Create arm dummies (reference = none)
    df["benef_org"] = (df["cue"] == "benef_org").astype(int)
    df["benef_self"] = (df["cue"] == "benef_self").astype(int)
    df["benef_other"] = (df["cue"] == "benef_other").astype(int)
    
    return df


def firth_logistic_regression(X: np.ndarray, y: np.ndarray) -> Dict:
    """Firth penalized logistic regression.
    
    Implements Firth's bias reduction by adding a penalty term to the
    log-likelihood. This helps with separation and small sample issues.
    
    Uses iteratively reweighted least squares with penalty matrix.
    
    Args:
        X: Design matrix (n × p) with intercept
        y: Binary outcomes (n,)
    
    Returns:
        Dictionary with coefficients, standard errors, p-values, log-likelihood
    """
    n, p = X.shape
    
    # Initialize with standard logistic regression
    try:
        init_model = sm.Logit(y, X).fit(disp=0, method='bfgs', maxiter=100)
        beta = init_model.params.values
    except Exception:
        # If that fails, initialize with zeros
        beta = np.zeros(p)
    
    # Firth iteration
    max_iter = 100
    tol = 1e-8
    
    for iteration in range(max_iter):
        # Linear predictor
        eta = X @ beta
        mu = 1 / (1 + np.exp(-eta))
        
        # Weight matrix
        W = np.diag(mu * (1 - mu))
        
        # Information matrix
        I = X.T @ W @ X
        
        # Firth penalty: add 0.5 * trace(W * hat) to working response
        try:
            I_inv = np.linalg.inv(I + np.eye(p) * 1e-10)
        except np.linalg.LinAlgError:
            # Singular matrix, use pseudoinverse
            I_inv = np.linalg.pinv(I + np.eye(p) * 1e-10)
        
        H = X @ I_inv @ X.T
        h = np.diag(H @ W)
        
        # Working response with Firth adjustment
        z = eta + (y - mu) / (mu * (1 - mu) + 1e-10) + h * (0.5 - mu) / (mu * (1 - mu) + 1e-10)
        
        # Update
        beta_new = I_inv @ X.T @ W @ z
        
        # Check convergence
        if np.max(np.abs(beta_new - beta)) < tol:
            beta = beta_new
            break
        
        beta = beta_new
    
    # Final quantities
    eta = X @ beta
    mu = 1 / (1 + np.exp(-eta))
    W = np.diag(mu * (1 - mu))
    I = X.T @ W @ X
    
    try:
        cov = np.linalg.inv(I + np.eye(p) * 1e-10)
    except np.linalg.LinAlgError:
        cov = np.linalg.pinv(I + np.eye(p) * 1e-10)
    
    se = np.sqrt(np.diag(cov))
    z_scores = beta / se
    p_values = 2 * (1 - stats.norm.cdf(np.abs(z_scores)))
    
    # Log-likelihood with Firth penalty
    loglik = np.sum(y * np.log(mu + 1e-10) + (1 - y) * np.log(1 - mu + 1e-10))
    loglik += 0.5 * np.log(np.linalg.det(I + np.eye(p) * 1e-10))
    
    return {
        "coefficients": beta,
        "se": se,
        "z": z_scores,
        "p": p_values,
        "loglik": loglik,
        "converged": iteration < max_iter - 1,
    }


def wald_tests_with_holm(coef: np.ndarray, se: np.ndarray, contrast_names: List[str]) -> pd.DataFrame:
    """Wald tests for pairwise comparisons with Holm-Bonferroni correction.
    
    Args:
        coef: Coefficients (intercept, benef_org, benef_self, benef_other)
        se: Standard errors
        contrast_names: Names of contrasts
    
    Returns:
        DataFrame with test statistics, p-values, and corrected p-values
    """
    # Pairwise comparisons (each arm vs none, which is the reference)
    # Coefficients 1, 2, 3 are the arm effects
    contrasts = {
        "org_vs_none": (1, 0, 0, 0),
        "self_vs_none": (0, 1, 0, 0),
        "other_vs_none": (0, 0, 1, 0),
    }
    
    results = []
    for name, c in contrasts.items():
        c = np.array(c)
        est = np.dot(c[1:], coef[1:])  # Skip intercept
        se_est = np.sqrt(np.dot(c[1:]**2, se[1:]**2))  # Simplified - assumes independence
        z = est / se_est
        p = 2 * (1 - stats.norm.cdf(np.abs(z)))
        results.append({"contrast": name, "estimate": est, "se": se_est, "z": z, "p": p})
    
    df = pd.DataFrame(results)
    
    # Holm-Bonferroni correction
    reject, pvals_corrected, alphac_sidak, alphac_bonf = multipletests(
        df["p"].values, alpha=0.05, method="holm"
    )
    df["p_holm"] = pvals_corrected
    df["reject_holm"] = reject
    
    return df


def average_marginal_effects(X: np.ndarray, coef: np.ndarray, arm_idx: int) -> float:
    """Compute average marginal effect for an arm.
    
    AME = average over all observations of dP(y=1)/d(arm).
    
    Args:
        X: Design matrix
        coef: Coefficients
        arm_idx: Index of arm dummy (1=org, 2=self, 3=other)
    
    Returns:
        Average marginal effect
    """
    # P(y=1|x) = expit(x'β)
    # dP/d(arm) = φ(x'β) * β_arm, where φ is the logistic density
    
    eta = X @ coef
    mu = 1 / (1 + np.exp(-eta))
    phi = mu * (1 - mu)
    
    ame = np.mean(phi * coef[arm_idx])
    return ame


def newcombe_hybrid_score_ci(n1: int, x1: int, n2: int, x2: int, alpha: float = 0.05) -> Tuple[float, float]:
    """Newcombe hybrid-score confidence interval for difference in proportions.
    
    Args:
        n1, x1: Sample size and successes for group 1
        n2, x2: Sample size and successes for group 2
        alpha: Significance level
    
    Returns:
        (lower, upper) bounds for p1 - p2
    """
    z = stats.norm.ppf(1 - alpha / 2)
    
    # Wilson score intervals for each proportion
    def wilson_ci(n, x):
        p = x / n
        denom = 1 + z**2 / n
        center = (p + z**2 / (2 * n)) / denom
        half_width = z * np.sqrt(p * (1 - p) / n + z**2 / (4 * n**2)) / denom
        return center - half_width, center + half_width
    
    l1, u1 = wilson_ci(n1, x1)
    l2, u2 = wilson_ci(n2, x2)
    
    p1 = x1 / n1
    p2 = x2 / n2
    diff = p1 - p2
    
    # Newcombe hybrid-score formula
    lower = diff - np.sqrt((p1 - l1)**2 + (u2 - p2)**2)
    upper = diff + np.sqrt((u1 - p1)**2 + (p2 - l2)**2)
    
    return lower, upper


def fisher_exact_tests(df: pd.DataFrame) -> pd.DataFrame:
    """Fisher exact test for each arm vs control (none).
    
    Args:
        df: DataFrame with 'cue' and 'y' columns
    
    Returns:
        DataFrame with test results
    """
    results = []
    
    control = df[df["cue"] == "none"]
    n_control = (~control["y"].isna()).sum()
    x_control = control["y"].sum()
    
    for arm in ["benef_org", "benef_self", "benef_other"]:
        arm_data = df[df["cue"] == arm]
        n_arm = (~arm_data["y"].isna()).sum()
        x_arm = arm_data["y"].sum()
        
        # 2x2 contingency table
        table = np.array([
            [x_arm, n_arm - x_arm],
            [x_control, n_control - x_control]
        ])
        
        odds_ratio, p_value = stats.fisher_exact(table)
        
        # Newcombe CI for difference
        p_arm = x_arm / n_arm if n_arm > 0 else 0
        p_control = x_control / n_control if n_control > 0 else 0
        diff = p_arm - p_control
        
        ci_lower, ci_upper = newcombe_hybrid_score_ci(n_arm, int(x_arm), n_control, int(x_control))
        
        results.append({
            "arm": arm,
            "n": n_arm,
            "x": int(x_arm),
            "p": p_arm,
            "p_control": p_control,
            "diff": diff,
            "ci_lower": ci_lower,
            "ci_upper": ci_upper,
            "odds_ratio": odds_ratio,
            "fisher_p": p_value,
        })
    
    return pd.DataFrame(results)


def likelihood_ratio_test(df: pd.DataFrame) -> Dict:
    """Likelihood ratio test for overall effect of arm.
    
    Compares:
    - Null model: intercept only
    - Full model: intercept + arm dummies
    
    Args:
        df: DataFrame with arm dummies and y
    
    Returns:
        Dictionary with LR statistic, df, and p-value
    """
    # Drop missing outcomes
    df_clean = df.dropna(subset=["y"])
    
    y = df_clean["y"].values
    X_null = sm.add_constant(np.ones(len(y)))
    X_full = sm.add_constant(df_clean[["benef_org", "benef_self", "benef_other"]].values)
    
    # Fit null model
    null_model = sm.Logit(y, X_null).fit(disp=0)
    loglik_null = null_model.llf
    
    # Fit full model
    full_model = sm.Logit(y, X_full).fit(disp=0)
    loglik_full = full_model.llf
    
    # LR statistic
    lr_stat = 2 * (loglik_full - loglik_null)
    df = 3  # 3 arm dummies
    p_value = 1 - chi2.cdf(lr_stat, df)
    
    return {
        "lr_statistic": lr_stat,
        "df": df,
        "p_value": p_value,
        "loglik_null": loglik_null,
        "loglik_full": loglik_full,
    }


def sensitivity_analysis(df: pd.DataFrame) -> Dict:
    """Sensitivity analysis excluding no_action and escalate.
    
    Rerun primary analysis on subset with only act/keep outcomes.
    """
    df_sens = df[df["outcome"].isin(["act", "keep"])].copy()
    
    # Same analysis as primary
    df_sens = df_sens.dropna(subset=["y"])
    y = df_sens["y"].values
    X = sm.add_constant(df_sens[["benef_org", "benef_self", "benef_other"]].values)
    
    # Firth regression
    firth_result = firth_logistic_regression(X, y)
    
    # Fisher exact tests
    fisher_results = fisher_exact_tests(df_sens)
    
    return {
        "n": len(df_sens),
        "n_excluded": len(df) - len(df_sens),
        "firth": {
            "coefficients": firth_result["coefficients"].tolist(),
            "se": firth_result["se"].tolist(),
            "p": firth_result["p"].tolist(),
        },
        "fisher": fisher_results.to_dict(orient="records"),
    }


def analyze_study1(data_file: Path) -> Dict:
    """Run full Study 1 analysis.
    
    Args:
        data_file: Path to JSONL data file
    
    Returns:
        Dictionary with all analysis results
    """
    print(f"Loading data from {data_file}...")
    df = load_data(data_file)
    
    print(f"Loaded {len(df)} records")
    print(f"Arms: {df['cue'].value_counts().to_dict()}")
    print(f"Outcomes: {df['outcome'].value_counts().to_dict()}")
    
    # Drop missing outcomes for regression
    df_clean = df.dropna(subset=["y"])
    print(f"Analysis sample: {len(df_clean)} records with act/keep outcomes")
    
    y = df_clean["y"].values
    X = sm.add_constant(df_clean[["benef_org", "benef_self", "benef_other"]].values)
    
    print("\n=== PRIMARY ANALYSIS: FIRTH LOGISTIC REGRESSION ===")
    firth_result = firth_logistic_regression(X, y)
    
    print(f"Converged: {firth_result['converged']}")
    print(f"Log-likelihood: {firth_result['loglik']:.4f}")
    print("\nCoefficients:")
    coef_names = ["Intercept", "benef_org", "benef_self", "benef_other"]
    for i, name in enumerate(coef_names):
        print(f"  {name:15s}: {firth_result['coefficients'][i]:7.4f} (SE={firth_result['se'][i]:.4f}, p={firth_result['p'][i]:.4f})")
    
    print("\n=== WALD TESTS WITH HOLM CORRECTION ===")
    wald_results = wald_tests_with_holm(firth_result["coefficients"], firth_result["se"], coef_names[1:])
    print(wald_results.to_string(index=False))
    
    print("\n=== AVERAGE MARGINAL EFFECTS ===")
    for i, arm in enumerate(["benef_org", "benef_self", "benef_other"], start=1):
        ame = average_marginal_effects(X, firth_result["coefficients"], i)
        print(f"  {arm:15s}: {ame:+.4f}")
    
    print("\n=== FISHER EXACT TESTS ===")
    fisher_results = fisher_exact_tests(df_clean)
    print(fisher_results.to_string(index=False))
    
    print("\n=== LIKELIHOOD RATIO TEST ===")
    lr_result = likelihood_ratio_test(df_clean)
    print(f"  LR statistic: {lr_result['lr_statistic']:.4f}")
    print(f"  df: {lr_result['df']}")
    print(f"  p-value: {lr_result['p_value']:.4f}")
    
    print("\n=== SENSITIVITY ANALYSIS (EXCLUDING NO_ACTION/ESCALATE) ===")
    sens_result = sensitivity_analysis(df)
    print(f"  Analysis sample: {sens_result['n']} records ({sens_result['n_excluded']} excluded)")
    
    # Assemble results
    results = {
        "n_total": len(df),
        "n_analysis": len(df_clean),
        "arm_counts": df["cue"].value_counts().to_dict(),
        "outcome_counts": df["outcome"].value_counts().to_dict(),
        "firth_regression": {
            "coefficients": firth_result["coefficients"].tolist(),
            "se": firth_result["se"].tolist(),
            "z": firth_result["z"].tolist(),
            "p": firth_result["p"].tolist(),
            "loglik": firth_result["loglik"],
            "converged": firth_result["converged"],
        },
        "wald_tests": wald_results.to_dict(orient="records"),
        "fisher_exact": fisher_results.to_dict(orient="records"),
        "likelihood_ratio": lr_result,
        "sensitivity": sens_result,
    }
    
    return results


def main():
    parser = argparse.ArgumentParser(description="Analyze Study 1: Beneficiary Control")
    parser.add_argument("data_file", type=Path, help="JSONL data file")
    parser.add_argument("--output", type=Path, help="Output JSON file")
    
    args = parser.parse_args()
    
    if not args.data_file.exists():
        print(f"Error: Data file not found: {args.data_file}", file=sys.stderr)
        sys.exit(1)
    
    results = analyze_study1(args.data_file)
    
    if args.output:
        with open(args.output, 'w') as f:
            json.dump(results, f, indent=2)
        print(f"\n✓ Results saved to {args.output}")
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
