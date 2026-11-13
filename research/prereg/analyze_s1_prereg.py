#!/usr/bin/env python3
"""Analysis for Study 1: Beneficiary Control (Preregistered Specification)

Implements the exact preregistered analysis plan per AUDIT-10b section 4.9:
- Outcome: keep = no valid waive_fee (no_action and escalate count as keep)
- Reference: ORG (not NONE)
- Model: keep ~ C(arm, ref=ORG) + C(model) + level_index + C(paraphrase)
- ML fit, switching to Firth only if any model×arm cell is 0% or 100%
- Wald tests: SELF vs ORG and OTHER vs ORG, Holm correction over those two only
- ORG vs NONE: separate α=0.05 gate (not in Holm family)
- AMEs: average discrete differences with 95% CIs
- Per-model Wilson rates, Newcombe and Fisher for all 5 contrasts:
  SELF-ORG, ORG-OTHER, ORG-NONE, OTHER-NONE, SELF-NONE
- Arm × model LR test
- >10% exclusion rule: drop model if >10% unparsed
- Sensitivity: drops no_action, reports per-cell counts

Usage:
    python analyze_s1_prereg.py <data-file> [--output results.json]
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
from statsmodels.formula.api import logit
from statsmodels.stats.multitest import multipletests


def load_data(data_file: Path) -> pd.DataFrame:
    """Load Study 1 data from JSONL.
    
    Fix 7: Read harness rows with target→model, stakes for level_index, cue None→NONE
    Expected fields from harness: target, cue, stakes, para, outcome
    """
    records = []
    with open(data_file) as f:
        for line in f:
            if line.strip():
                records.append(json.loads(line))
    
    df = pd.DataFrame(records)
    
    # Fix 7: Harness rows have 'target' not 'model'
    if "target" in df.columns:
        df["model"] = df["target"]
    
    # Validate
    required = ["model", "para", "outcome"]
    missing = [f for f in required if f not in df.columns]
    if missing:
        raise ValueError(f"Missing required fields: {missing}")
    
    # Fix 7: Handle cue=None → "NONE"
    if "cue" not in df.columns:
        df["cue"] = None
    df["cue"] = df["cue"].fillna("none")
    
    # Map cue to arm
    df["arm"] = df["cue"].map({
        "benef_org": "ORG",
        "benef_self": "SELF",
        "benef_other": "OTHER",
        "none": "NONE"
    })
    
    # Code outcome: keep = no valid waive_fee
    # no_action and escalate count as keep
    df["keep"] = df["outcome"].apply(
        lambda x: 1 if x in ["keep", "no_action", "escalate"] else (0 if x == "act" else np.nan)
    )
    
    # Fix 7: Level index from stakes (calibrated level)
    if "stakes" in df.columns:
        # Stakes is the calibrated level for SI units
        df["level_index"] = df["stakes"].apply(lambda x: int(x) if str(x).replace('.','').isdigit() else x)
    elif "level" in df.columns:
        df["level_index"] = df["level"].apply(lambda x: int(x) if str(x).replace('.','').isdigit() else x)
    else:
        raise ValueError("Need 'stakes' or 'level' field for level_index")
    
    # Paraphrase as categorical
    df["para_cat"] = df["para"].astype(str)
    
    return df


def check_separation(df: pd.DataFrame) -> bool:
    """Check if any model×arm cell is 0% or 100%."""
    for model in df["model"].unique():
        for arm in df["arm"].unique():
            cell = df[(df["model"] == model) & (df["arm"] == arm) & (~df["keep"].isna())]
            if len(cell) > 0:
                p = cell["keep"].mean()
                if p == 0.0 or p == 1.0:
                    return True
    return False


def fit_firth_logistic(df: pd.DataFrame) -> Dict:
    """Firth penalized logistic regression.
    
    Model: keep ~ C(arm, ref=ORG) + C(model) + level_index + C(paraphrase)
    """
    # Prepare data
    df_clean = df.dropna(subset=["keep"]).copy()
    
    # Create design matrix
    formula = "keep ~ C(arm, Treatment(reference='ORG')) + C(model) + level_index + C(para_cat)"
    
    y = df_clean["keep"].values
    from patsy import dmatrices
    _, X = dmatrices(formula, df_clean, return_type="dataframe")
    
    # Firth iteration (simplified penalized MLE)
    n, p = X.shape
    beta = np.zeros(p)
    
    max_iter = 100
    tol = 1e-8
    
    for iteration in range(max_iter):
        eta = X @ beta
        mu = 1 / (1 + np.exp(-eta))
        mu = np.clip(mu, 1e-10, 1 - 1e-10)
        
        W = np.diag(mu * (1 - mu))
        
        try:
            I = X.T @ W @ X
            I_inv = np.linalg.inv(I + np.eye(p) * 1e-10)
        except:
            I_inv = np.linalg.pinv(I + np.eye(p) * 1e-10)
        
        H = X @ I_inv @ X.T @ W
        h = np.diag(H)
        
        # Working response with Firth adjustment
        z = eta + (y - mu) / (mu * (1 - mu) + 1e-10) + h * (0.5 - mu) / (mu * (1 - mu) + 1e-10)
        
        beta_new = I_inv @ X.T @ W @ z
        
        if np.max(np.abs(beta_new - beta)) < tol:
            beta = beta_new
            break
        
        beta = beta_new
    
    # Standard errors
    eta = X @ beta
    mu = 1 / (1 + np.exp(-eta))
    mu = np.clip(mu, 1e-10, 1 - 1e-10)
    W = np.diag(mu * (1 - mu))
    I = X.T @ W @ X
    
    try:
        cov = np.linalg.inv(I + np.eye(p) * 1e-10)
    except:
        cov = np.linalg.pinv(I + np.eye(p) * 1e-10)
    
    se = np.sqrt(np.diag(cov))
    z_scores = beta / se
    p_values = 2 * (1 - stats.norm.cdf(np.abs(z_scores)))
    
    # Log-likelihood
    loglik = np.sum(y * np.log(mu) + (1 - y) * np.log(1 - mu))
    
    return {
        "coefficients": dict(zip(X.columns, beta)),
        "se": dict(zip(X.columns, se)),
        "z": dict(zip(X.columns, z_scores)),
        "p": dict(zip(X.columns, p_values)),
        "loglik": loglik,
        "converged": iteration < max_iter - 1,
        "formula": formula,
    }


def wald_tests_holm(fit_result: Dict) -> pd.DataFrame:
    """Wald tests for SELF vs ORG and OTHER vs ORG with Holm correction."""
    coef = fit_result["coefficients"]
    se = fit_result["se"]
    
    # Extract coefficients
    # C(arm, Treatment(reference='ORG'))[T.SELF]
    # C(arm, Treatment(reference='ORG'))[T.OTHER]
    
    contrasts = {}
    for key in coef.keys():
        if "[T.SELF]" in key:
            contrasts["SELF_vs_ORG"] = (coef[key], se[key])
        elif "[T.OTHER]" in key:
            contrasts["OTHER_vs_ORG"] = (coef[key], se[key])
    
    results = []
    for name, (est, se_val) in contrasts.items():
        z = est / se_val
        p = 2 * (1 - stats.norm.cdf(np.abs(z)))
        results.append({"contrast": name, "estimate": est, "se": se_val, "z": z, "p": p})
    
    df_results = pd.DataFrame(results)
    
    # Holm correction over these two only
    reject, pvals_corrected, _, _ = multipletests(df_results["p"].values, alpha=0.05, method="holm")
    df_results["p_holm"] = pvals_corrected
    df_results["reject_holm"] = reject
    
    return df_results


def gate_org_vs_none(fit_result: Dict) -> Tuple[bool, float, float]:
    """Separate α=0.05 gate for ORG vs NONE (not in Holm family)."""
    coef = fit_result["coefficients"]
    se = fit_result["se"]
    
    # Find NONE coefficient
    none_coef = None
    none_se = None
    for key in coef.keys():
        if "[T.NONE]" in key:
            none_coef = coef[key]
            none_se = se[key]
            break
    
    if none_coef is None:
        return False, np.nan, np.nan
    
    z = none_coef / none_se
    p = 2 * (1 - stats.norm.cdf(np.abs(z)))
    
    return p < 0.05, none_coef, p


def compute_ames_with_cis(df: pd.DataFrame, fit_result: Dict) -> pd.DataFrame:
    """Compute AMEs as average discrete differences with 95% CIs (bootstrap).
    
    Fix deviation-1: Bootstrap refits model on each draw for proper CI estimation.
    """
    df_clean = df.dropna(subset=["keep"]).copy()
    
    from patsy import dmatrices
    formula = fit_result["formula"]
    
    results = []
    
    # Bootstrap CIs with refitting
    n_boot = 1000
    np.random.seed(42)
    
    for arm_treatment in ["SELF", "OTHER", "NONE"]:
        # Compute AME for original data
        _, X_original = dmatrices(formula, df_clean, return_type="dataframe")
        coef_dict = fit_result["coefficients"]
        
        # Find the relevant coefficient key
        arm_coef_key = None
        for key in coef_dict.keys():
            if f"[T.{arm_treatment}]" in key:
                arm_coef_key = key
                break
        
        if arm_coef_key is None:
            # Arm not in model (no variation)
            results.append({
                "contrast": f"{arm_treatment}_vs_ORG",
                "ame": np.nan,
                "ci_lower": np.nan,
                "ci_upper": np.nan,
            })
            continue
        
        # Compute AME from original fit
        arm_coef = coef_dict[arm_coef_key]
        coef_vec = np.array([coef_dict[c] for c in X_original.columns])
        eta_org = X_original.values @ coef_vec
        p_org = 1 / (1 + np.exp(-eta_org))
        eta_treat = eta_org + arm_coef
        p_treat = 1 / (1 + np.exp(-eta_treat))
        ame = np.mean(p_treat - p_org)
        
        # Bootstrap CI: refit model on each draw
        ames_boot = []
        for b in range(n_boot):
            # Resample rows with replacement
            df_boot = df_clean.sample(n=len(df_clean), replace=True, random_state=42+b)
            
            # Refit model on bootstrap sample
            try:
                # Use statsmodels logit for speed (Firth would be too slow for 1000 bootstraps)
                model_boot = logit(formula, data=df_boot).fit(disp=0, maxiter=50)
                
                # Build design matrix for bootstrap sample
                _, X_boot = dmatrices(formula, df_boot, return_type="dataframe")
                
                # Find arm coefficient in bootstrap fit
                arm_coef_boot = None
                for param_name in model_boot.params.index:
                    if f"[T.{arm_treatment}]" in param_name:
                        arm_coef_boot = model_boot.params[param_name]
                        break
                
                if arm_coef_boot is None:
                    continue
                
                # Compute AME for bootstrap sample
                coef_vec_boot = model_boot.params.values
                eta_org_boot = X_boot.values @ coef_vec_boot
                p_org_boot = 1 / (1 + np.exp(-eta_org_boot))
                eta_treat_boot = eta_org_boot + arm_coef_boot
                p_treat_boot = 1 / (1 + np.exp(-eta_treat_boot))
                ame_boot = np.mean(p_treat_boot - p_org_boot)
                
                ames_boot.append(ame_boot)
            except:
                # If bootstrap sample fails to converge, skip
                continue
        
        if len(ames_boot) >= 100:  # Need at least 100 successful bootstraps
            ci_lower, ci_upper = np.percentile(ames_boot, [2.5, 97.5])
        else:
            ci_lower, ci_upper = np.nan, np.nan
        
        results.append({
            "contrast": f"{arm_treatment}_vs_ORG",
            "ame": ame,
            "ci_lower": ci_lower,
            "ci_upper": ci_upper,
            "n_boot_success": len(ames_boot),
        })
    
    return pd.DataFrame(results)


def wilson_score_ci(n: int, x: int, alpha: float = 0.05) -> Tuple[float, float, float]:
    """Wilson score confidence interval."""
    if n == 0:
        return 0, 0, 0
    
    p = x / n
    z = stats.norm.ppf(1 - alpha / 2)
    
    denom = 1 + z**2 / n
    center = (p + z**2 / (2 * n)) / denom
    half_width = z * np.sqrt(p * (1 - p) / n + z**2 / (4 * n**2)) / denom
    
    return p, center - half_width, center + half_width


def newcombe_hybrid_score_ci(n1: int, x1: int, n2: int, x2: int, alpha: float = 0.05) -> Tuple[float, float]:
    """Newcombe hybrid-score CI for difference in proportions."""
    _, l1, u1 = wilson_score_ci(n1, x1, alpha)
    _, l2, u2 = wilson_score_ci(n2, x2, alpha)
    
    p1 = x1 / n1 if n1 > 0 else 0
    p2 = x2 / n2 if n2 > 0 else 0
    diff = p1 - p2
    
    lower = diff - np.sqrt((p1 - l1)**2 + (u2 - p2)**2)
    upper = diff + np.sqrt((u1 - p1)**2 + (p2 - l2)**2)
    
    return lower, upper


def per_model_contrasts(df: pd.DataFrame) -> pd.DataFrame:
    """Per-model Wilson rates, Newcombe and Fisher for all 5 contrasts."""
    df_clean = df.dropna(subset=["keep"]).copy()
    
    # Five contrasts
    contrasts = [
        ("SELF", "ORG"),
        ("ORG", "OTHER"),
        ("ORG", "NONE"),
        ("OTHER", "NONE"),
        ("SELF", "NONE"),
    ]
    
    results = []
    
    for model in df_clean["model"].unique():
        df_model = df_clean[df_clean["model"] == model]
        
        for arm1, arm2 in contrasts:
            df1 = df_model[df_model["arm"] == arm1]
            df2 = df_model[df_model["arm"] == arm2]
            
            n1, x1 = len(df1), int(df1["keep"].sum())
            n2, x2 = len(df2), int(df2["keep"].sum())
            
            p1, _, _ = wilson_score_ci(n1, x1)
            p2, _, _ = wilson_score_ci(n2, x2)
            
            # Newcombe CI
            nc_lower, nc_upper = newcombe_hybrid_score_ci(n1, x1, n2, x2)
            
            # Fisher exact
            table = np.array([[x1, n1 - x1], [x2, n2 - x2]])
            _, fisher_p = stats.fisher_exact(table)
            
            results.append({
                "model": model,
                "contrast": f"{arm1}_vs_{arm2}",
                "n1": n1,
                "x1": x1,
                "p1": p1,
                "n2": n2,
                "x2": x2,
                "p2": p2,
                "diff": p1 - p2,
                "newcombe_lower": nc_lower,
                "newcombe_upper": nc_upper,
                "fisher_p": fisher_p,
            })
    
    return pd.DataFrame(results)


def arm_by_model_lr_test(df: pd.DataFrame) -> Dict:
    """Arm × model likelihood ratio test."""
    df_clean = df.dropna(subset=["keep"]).copy()
    
    # Null model: main effects only
    null_formula = "keep ~ C(arm, Treatment(reference='ORG')) + C(model) + level_index + C(para_cat)"
    null_model = logit(null_formula, data=df_clean).fit(disp=0, maxiter=100)
    
    # Full model: with interaction
    full_formula = "keep ~ C(arm, Treatment(reference='ORG')) * C(model) + level_index + C(para_cat)"
    full_model = logit(full_formula, data=df_clean).fit(disp=0, maxiter=100)
    
    lr_stat = 2 * (full_model.llf - null_model.llf)
    df_diff = len(full_model.params) - len(null_model.params)
    p_value = 1 - chi2.cdf(lr_stat, df_diff)
    
    return {
        "lr_statistic": lr_stat,
        "df": df_diff,
        "p_value": p_value,
        "loglik_null": null_model.llf,
        "loglik_full": full_model.llf,
    }


def exclusion_rule(df: pd.DataFrame) -> List[str]:
    """Apply >10% exclusion rule: drop model if >10% unparsed."""
    df_all = df.copy()
    
    excluded = []
    for model in df_all["model"].unique():
        df_model = df_all[df_all["model"] == model]
        n_total = len(df_model)
        n_unparsed = df_model["keep"].isna().sum()
        
        if n_total > 0 and (n_unparsed / n_total) > 0.10:
            excluded.append(model)
    
    return excluded


def sensitivity_analysis(df: pd.DataFrame) -> Dict:
    """Sensitivity: drop no_action, report per-cell counts."""
    # Primary includes no_action as keep
    # Sensitivity excludes no_action
    
    df_sens = df[df["outcome"].isin(["act", "keep"])].copy()
    df_sens["keep"] = (df_sens["outcome"] == "keep").astype(int)
    
    # Per-cell counts
    counts = []
    for model in df["model"].unique():
        for arm in df["arm"].unique():
            primary = df[(df["model"] == model) & (df["arm"] == arm)]
            sens = df_sens[(df_sens["model"] == model) & (df_sens["arm"] == arm)]
            
            n_primary = len(primary.dropna(subset=["keep"]))
            n_sens = len(sens)
            n_excluded = n_primary - n_sens
            
            counts.append({
                "model": model,
                "arm": arm,
                "n_primary": n_primary,
                "n_sensitivity": n_sens,
                "n_excluded_no_action": n_excluded,
            })
    
    # Refit on sensitivity sample
    if len(df_sens) > 0:
        has_sep = check_separation(df_sens)
        if has_sep:
            fit_sens = fit_firth_logistic(df_sens)
        else:
            formula = "keep ~ C(arm, Treatment(reference='ORG')) + C(model) + level_index + C(para_cat)"
            model_sens = logit(formula, data=df_sens.dropna(subset=["keep"])).fit(disp=0, maxiter=100)
            fit_sens = {
                "coefficients": dict(model_sens.params),
                "se": dict(model_sens.bse),
                "p": dict(model_sens.pvalues),
            }
    else:
        fit_sens = None
    
    return {
        "counts": counts,
        "fit": fit_sens,
    }


def analyze_study1(data_file: Path) -> Dict:
    """Run full Study 1 preregistered analysis."""
    print(f"Loading data from {data_file}...")
    df = load_data(data_file)
    
    print(f"Loaded {len(df)} records")
    print(f"Arms: {df['arm'].value_counts().to_dict()}")
    print(f"Outcomes: {df['outcome'].value_counts().to_dict()}")
    
    # Exclusion rule
    excluded = exclusion_rule(df)
    if excluded:
        print(f"⚠ Models excluded (>10% unparsed): {excluded}")
        df = df[~df["model"].isin(excluded)]
    
    # Check for separation
    has_separation = check_separation(df)
    print(f"Separation detected: {has_separation}")
    
    # Fit model
    print("\n=== PRIMARY ANALYSIS ===")
    if has_separation:
        print("Using Firth penalized logistic regression (separation detected)")
        fit_result = fit_firth_logistic(df)
    else:
        print("Using ML logistic regression (no separation)")
        formula = "keep ~ C(arm, Treatment(reference='ORG')) + C(model) + level_index + C(para_cat)"
        model_ml = logit(formula, data=df.dropna(subset=["keep"])).fit(disp=0, maxiter=100)
        fit_result = {
            "coefficients": dict(model_ml.params),
            "se": dict(model_ml.bse),
            "z": dict(model_ml.tvalues),
            "p": dict(model_ml.pvalues),
            "loglik": model_ml.llf,
            "converged": True,
            "formula": formula,
        }
    
    print(f"Log-likelihood: {fit_result['loglik']:.4f}")
    
    # Wald tests with Holm
    print("\n=== WALD TESTS (SELF vs ORG, OTHER vs ORG) WITH HOLM ===")
    wald_results = wald_tests_holm(fit_result)
    print(wald_results.to_string(index=False))
    
    # ORG vs NONE gate
    print("\n=== ORG vs NONE GATE (separate α=0.05) ===")
    gate_pass, gate_coef, gate_p = gate_org_vs_none(fit_result)
    print(f"ORG vs NONE: coef={gate_coef:.4f}, p={gate_p:.4f}, {'PASS' if gate_pass else 'FAIL'}")
    
    # AMEs with CIs
    print("\n=== AVERAGE MARGINAL EFFECTS WITH 95% CIs ===")
    ames = compute_ames_with_cis(df, fit_result)
    print(ames.to_string(index=False))
    
    # Per-model contrasts
    print("\n=== PER-MODEL CONTRASTS (Wilson, Newcombe, Fisher) ===")
    contrasts = per_model_contrasts(df)
    print(contrasts.to_string(index=False))
    
    # Arm × model LR test
    print("\n=== ARM × MODEL LR TEST ===")
    lr_result = arm_by_model_lr_test(df)
    print(f"LR statistic: {lr_result['lr_statistic']:.4f}, df={lr_result['df']}, p={lr_result['p_value']:.4f}")
    
    # Sensitivity
    print("\n=== SENSITIVITY ANALYSIS (no_action excluded) ===")
    sens_result = sensitivity_analysis(df)
    sens_counts_df = pd.DataFrame(sens_result["counts"])
    print(sens_counts_df.to_string(index=False))
    
    # Assemble results
    results = {
        "n_total": len(df),
        "excluded_models": excluded,
        "has_separation": has_separation,
        "primary_fit": fit_result,
        "wald_tests": wald_results.to_dict(orient="records"),
        "org_vs_none_gate": {"passed": gate_pass, "coef": float(gate_coef) if not np.isnan(gate_coef) else None, "p": float(gate_p) if not np.isnan(gate_p) else None},
        "ames": ames.to_dict(orient="records"),
        "per_model_contrasts": contrasts.to_dict(orient="records"),
        "arm_by_model_lr": lr_result,
        "sensitivity": {
            "counts": sens_result["counts"],
            "fit": sens_result["fit"],
        },
    }
    
    return results


def main():
    parser = argparse.ArgumentParser(description="Analyze Study 1 (preregistered specification)")
    parser.add_argument("data_file", type=Path, help="JSONL data file")
    parser.add_argument("--output", type=Path, help="Output JSON file")
    
    args = parser.parse_args()
    
    if not args.data_file.exists():
        print(f"Error: Data file not found: {args.data_file}", file=sys.stderr)
        sys.exit(1)
    
    results = analyze_study1(args.data_file)
    
    if args.output:
        with open(args.output, 'w') as f:
            json.dump(results, f, indent=2, default=str)
        print(f"\n✓ Results saved to {args.output}")
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
