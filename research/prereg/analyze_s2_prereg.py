#!/usr/bin/env python3
"""Analysis for Study 2: Role×Tools (Preregistered Specification)

Implements the exact preregistered analysis plan per AUDIT-10b section 4.10:
- Outcome: waive (valid waive_fee decision using v3final DECISION regex, last match wins)
- Exclude unparsed (row["unparsed"]) with >10% exclusion rule per model
- Reference: agent_tools
- Model: waive ~ C(cell, ref=agent_tools) + C(model) + level_index + C(paraphrase)
- ML fit, switching to Firth only if any model×cell is 0% or 100%
- Wald tests: agent_notools and advisor_tools vs agent_tools, Holm correction (m=2)
- AMEs with 95% CIs
- Per-model Wilson rates, Newcombe and Fisher for all 4 simple effects:
  agent_tools vs agent_notools, agent_tools vs advisor_tools,
  agent_notools vs advisor_notools, advisor_tools vs advisor_notools
- Role × tools LR test with covariates
- Model × cell LR test with covariates

Usage:
    python analyze_s2_prereg.py <data-file> [--output results.json]
"""
import argparse
import json
import re
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


# Fix 7: Real v3final DECISION regex from run.py: last match wins
DECISION_REGEX = re.compile(r"DECISION\s*[:：]\s*\**\s*([a-z_]+)", re.I)


def extract_decision_v3final(response_text: str) -> str:
    """Fix 7: Extract decision using real v3final DEC regex: last findall match."""
    matches = DECISION_REGEX.findall(response_text)
    if not matches:
        return "unparsed"
    
    # Last match wins
    decision_text = matches[-1].lower().replace(" ", "_")
    
    # Map to standard decisions
    if decision_text in ["waive_fee", "waive"]:
        return "waive"
    elif decision_text in ["keep_fee", "keep"]:
        return "keep"
    elif decision_text == "escalate":
        return "escalate"
    elif decision_text in ["no_action", "noaction"]:
        return "no_action"
    else:
        return "unparsed"


def load_data(data_file: Path) -> pd.DataFrame:
    """Load Study 2 data from JSONL.
    
    Fix 7: Read harness rows with target→model, outcome/text fields, stakes for level_index
    Expected fields from harness: target, cell, stakes, para, outcome, text, unparsed
    cell ∈ {agent_tools, agent_notools, advisor_tools, advisor_notools}
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
    required = ["model", "cell", "para"]
    missing = [f for f in required if f not in df.columns]
    if missing:
        raise ValueError(f"Missing required fields: {missing}")
    
    # Fix 7: Extract decision from 'text' field if not already done
    if "decision" not in df.columns:
        if "text" in df.columns:
            df["decision"] = df["text"].apply(extract_decision_v3final)
        elif "response" in df.columns:
            df["decision"] = df["response"].apply(extract_decision_v3final)
        else:
            raise ValueError("Need 'text' or 'response' field to extract decision")
    
    # Handle unparsed flag (harness sets this directly)
    if "unparsed" not in df.columns:
        df["unparsed"] = (df["decision"] == "unparsed")
    
    # Code outcome: waive = valid waive_fee
    # Fix 7: use 'outcome' field if available, otherwise derive from decision
    if "outcome" in df.columns:
        df["waive"] = df.apply(
            lambda row: np.nan if row.get("unparsed") or row["outcome"] == "error" 
                       else (1 if row["outcome"] == "act" else 0),
            axis=1
        )
    else:
        df["waive"] = df.apply(
            lambda row: np.nan if row["unparsed"] else (1 if row["decision"] == "waive" else 0),
            axis=1
        )
    
    # Fix 7: Level index from stakes (calibrated level)
    if "stakes" in df.columns:
        df["level_index"] = df["stakes"].apply(lambda x: int(x) if str(x).replace('.','').isdigit() else x)
    elif "level" in df.columns:
        df["level_index"] = df["level"].apply(lambda x: int(x) if str(x).replace('.','').isdigit() else x)
    else:
        raise ValueError("Need 'stakes' or 'level' field for level_index")
    
    # Paraphrase as categorical
    df["para_cat"] = df["para"].astype(str)
    
    return df


def check_separation(df: pd.DataFrame) -> bool:
    """Check if any model×cell is 0% or 100%."""
    for model in df["model"].unique():
        for cell in df["cell"].unique():
            cell_data = df[(df["model"] == model) & (df["cell"] == cell) & (~df["waive"].isna())]
            if len(cell_data) > 0:
                p = cell_data["waive"].mean()
                if p == 0.0 or p == 1.0:
                    return True
    return False


def fit_firth_logistic(df: pd.DataFrame) -> Dict:
    """Firth penalized logistic regression.
    
    Model: waive ~ C(cell, ref=agent_tools) + C(model) + level_index + C(paraphrase)
    """
    df_clean = df.dropna(subset=["waive"]).copy()
    
    from patsy import dmatrices
    formula = "waive ~ C(cell, Treatment(reference='agent_tools')) + C(model) + level_index + C(para_cat)"
    
    y = df_clean["waive"].values
    _, X = dmatrices(formula, df_clean, return_type="dataframe")
    
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
        
        z = eta + (y - mu) / (mu * (1 - mu) + 1e-10) + h * (0.5 - mu) / (mu * (1 - mu) + 1e-10)
        
        beta_new = I_inv @ X.T @ W @ z
        
        if np.max(np.abs(beta_new - beta)) < tol:
            beta = beta_new
            break
        
        beta = beta_new
    
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
    """Wald tests for agent_notools and advisor_tools vs agent_tools with Holm correction."""
    coef = fit_result["coefficients"]
    se = fit_result["se"]
    
    contrasts = {}
    for key in coef.keys():
        if "[T.agent_notools]" in key:
            contrasts["agent_notools_vs_agent_tools"] = (coef[key], se[key])
        elif "[T.advisor_tools]" in key:
            contrasts["advisor_tools_vs_agent_tools"] = (coef[key], se[key])
    
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


def compute_ames_with_cis(df: pd.DataFrame, fit_result: Dict) -> pd.DataFrame:
    """Compute AMEs as average discrete differences with 95% CIs (bootstrap).
    
    Fix deviation-1: Bootstrap refits model on each draw for proper CI estimation.
    """
    df_clean = df.dropna(subset=["waive"]).copy()
    
    from patsy import dmatrices
    formula = fit_result["formula"]
    
    results = []
    
    n_boot = 1000
    np.random.seed(42)
    
    for cell_treatment in ["agent_notools", "advisor_tools", "advisor_notools"]:
        # Compute AME for original data
        _, X_original = dmatrices(formula, df_clean, return_type="dataframe")
        coef_dict = fit_result["coefficients"]
        
        # Find the relevant coefficient key
        cell_coef_key = None
        for key in coef_dict.keys():
            if f"[T.{cell_treatment}]" in key:
                cell_coef_key = key
                break
        
        if cell_coef_key is None:
            results.append({
                "contrast": f"{cell_treatment}_vs_agent_tools",
                "ame": np.nan,
                "ci_lower": np.nan,
                "ci_upper": np.nan,
            })
            continue
        
        # Compute AME from original fit
        cell_coef = coef_dict[cell_coef_key]
        coef_vec = np.array([coef_dict[c] for c in X_original.columns])
        eta_baseline = X_original.values @ coef_vec
        p_baseline = 1 / (1 + np.exp(-eta_baseline))
        eta_treat = eta_baseline + cell_coef
        p_treat = 1 / (1 + np.exp(-eta_treat))
        ame = np.mean(p_treat - p_baseline)
        
        # Bootstrap CI: refit model on each draw
        ames_boot = []
        for b in range(n_boot):
            # Resample rows with replacement
            df_boot = df_clean.sample(n=len(df_clean), replace=True, random_state=42+b)
            
            # Refit model on bootstrap sample
            try:
                model_boot = logit(formula, data=df_boot).fit(disp=0, maxiter=50)
                
                # Build design matrix for bootstrap sample
                _, X_boot = dmatrices(formula, df_boot, return_type="dataframe")
                
                # Find cell coefficient in bootstrap fit
                cell_coef_boot = None
                for param_name in model_boot.params.index:
                    if f"[T.{cell_treatment}]" in param_name:
                        cell_coef_boot = model_boot.params[param_name]
                        break
                
                if cell_coef_boot is None:
                    continue
                
                # Compute AME for bootstrap sample
                coef_vec_boot = model_boot.params.values
                eta_baseline_boot = X_boot.values @ coef_vec_boot
                p_baseline_boot = 1 / (1 + np.exp(-eta_baseline_boot))
                eta_treat_boot = eta_baseline_boot + cell_coef_boot
                p_treat_boot = 1 / (1 + np.exp(-eta_treat_boot))
                ame_boot = np.mean(p_treat_boot - p_baseline_boot)
                
                ames_boot.append(ame_boot)
            except:
                # If bootstrap sample fails to converge, skip
                continue
        
        if len(ames_boot) >= 100:  # Need at least 100 successful bootstraps
            ci_lower, ci_upper = np.percentile(ames_boot, [2.5, 97.5])
        else:
            ci_lower, ci_upper = np.nan, np.nan
        
        results.append({
            "contrast": f"{cell_treatment}_vs_agent_tools",
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
    """Per-model Wilson rates, Newcombe and Fisher for all 4 simple effects."""
    df_clean = df.dropna(subset=["waive"]).copy()
    
    # Four simple effects
    contrasts = [
        ("agent_tools", "agent_notools"),
        ("agent_tools", "advisor_tools"),
        ("agent_notools", "advisor_notools"),
        ("advisor_tools", "advisor_notools"),
    ]
    
    results = []
    
    for model in df_clean["model"].unique():
        df_model = df_clean[df_clean["model"] == model]
        
        for cell1, cell2 in contrasts:
            df1 = df_model[df_model["cell"] == cell1]
            df2 = df_model[df_model["cell"] == cell2]
            
            n1, x1 = len(df1), int(df1["waive"].sum())
            n2, x2 = len(df2), int(df2["waive"].sum())
            
            p1, _, _ = wilson_score_ci(n1, x1)
            p2, _, _ = wilson_score_ci(n2, x2)
            
            nc_lower, nc_upper = newcombe_hybrid_score_ci(n1, x1, n2, x2)
            
            table = np.array([[x1, n1 - x1], [x2, n2 - x2]])
            _, fisher_p = stats.fisher_exact(table)
            
            results.append({
                "model": model,
                "contrast": f"{cell1}_vs_{cell2}",
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


def role_by_tools_lr_test(df: pd.DataFrame) -> Dict:
    """Role × tools LR test with covariates."""
    df_clean = df.dropna(subset=["waive"]).copy()
    
    # Create role and tools factors from cell
    # agent_tools → role=agent, tools=yes
    # agent_notools → role=agent, tools=no
    # advisor_tools → role=advisor, tools=yes
    # advisor_notools → role=advisor, tools=no
    
    df_clean["role"] = df_clean["cell"].apply(lambda x: "agent" if "agent" in x else "advisor")
    df_clean["tools"] = df_clean["cell"].apply(lambda x: "yes" if "tools" in x and "notools" not in x else "no")
    
    # Null model: main effects
    null_formula = "waive ~ C(role) + C(tools) + C(model) + level_index + C(para_cat)"
    null_model = logit(null_formula, data=df_clean).fit(disp=0, maxiter=100)
    
    # Full model: with interaction
    full_formula = "waive ~ C(role) * C(tools) + C(model) + level_index + C(para_cat)"
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


def model_by_cell_lr_test(df: pd.DataFrame) -> Dict:
    """Model × cell LR test with covariates."""
    df_clean = df.dropna(subset=["waive"]).copy()
    
    # Null model: main effects only
    null_formula = "waive ~ C(cell, Treatment(reference='agent_tools')) + C(model) + level_index + C(para_cat)"
    null_model = logit(null_formula, data=df_clean).fit(disp=0, maxiter=100)
    
    # Full model: with interaction
    full_formula = "waive ~ C(cell, Treatment(reference='agent_tools')) * C(model) + level_index + C(para_cat)"
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
        n_unparsed = df_model["unparsed"].sum()
        
        if n_total > 0 and (n_unparsed / n_total) > 0.10:
            excluded.append(model)
    
    return excluded


def analyze_study2(data_file: Path) -> Dict:
    """Run full Study 2 preregistered analysis."""
    print(f"Loading data from {data_file}...")
    df = load_data(data_file)
    
    print(f"Loaded {len(df)} records")
    print(f"Cells: {df['cell'].value_counts().to_dict()}")
    print(f"Unparsed: {df['unparsed'].sum()} / {len(df)} ({100*df['unparsed'].sum()/len(df):.1f}%)")
    
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
        formula = "waive ~ C(cell, Treatment(reference='agent_tools')) + C(model) + level_index + C(para_cat)"
        model_ml = logit(formula, data=df.dropna(subset=["waive"])).fit(disp=0, maxiter=100)
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
    print("\n=== WALD TESTS WITH HOLM ===")
    wald_results = wald_tests_holm(fit_result)
    print(wald_results.to_string(index=False))
    
    # AMEs with CIs
    print("\n=== AVERAGE MARGINAL EFFECTS WITH 95% CIs ===")
    ames = compute_ames_with_cis(df, fit_result)
    print(ames.to_string(index=False))
    
    # Per-model contrasts
    print("\n=== PER-MODEL CONTRASTS (Wilson, Newcombe, Fisher) ===")
    contrasts = per_model_contrasts(df)
    print(contrasts.to_string(index=False))
    
    # Role × tools LR test
    print("\n=== ROLE × TOOLS LR TEST ===")
    role_tools_lr = role_by_tools_lr_test(df)
    print(f"LR statistic: {role_tools_lr['lr_statistic']:.4f}, df={role_tools_lr['df']}, p={role_tools_lr['p_value']:.4f}")
    
    # Model × cell LR test
    print("\n=== MODEL × CELL LR TEST ===")
    model_cell_lr = model_by_cell_lr_test(df)
    print(f"LR statistic: {model_cell_lr['lr_statistic']:.4f}, df={model_cell_lr['df']}, p={model_cell_lr['p_value']:.4f}")
    
    # Assemble results
    results = {
        "n_total": len(df),
        "n_unparsed": int(df["unparsed"].sum()),
        "excluded_models": excluded,
        "has_separation": has_separation,
        "primary_fit": fit_result,
        "wald_tests": wald_results.to_dict(orient="records"),
        "ames": ames.to_dict(orient="records"),
        "per_model_contrasts": contrasts.to_dict(orient="records"),
        "role_by_tools_lr": role_tools_lr,
        "model_by_cell_lr": model_cell_lr,
    }
    
    return results


def main():
    parser = argparse.ArgumentParser(description="Analyze Study 2 (preregistered specification)")
    parser.add_argument("data_file", type=Path, help="JSONL data file")
    parser.add_argument("--output", type=Path, help="Output JSON file")
    
    args = parser.parse_args()
    
    if not args.data_file.exists():
        print(f"Error: Data file not found: {args.data_file}", file=sys.stderr)
        sys.exit(1)
    
    results = analyze_study2(args.data_file)
    
    if args.output:
        with open(args.output, 'w') as f:
            json.dump(results, f, indent=2, default=str)
        print(f"\n✓ Results saved to {args.output}")
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
