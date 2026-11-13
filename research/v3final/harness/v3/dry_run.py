#!/usr/bin/env python3
"""Dry-run cost projections for preregistered studies using measured per-unit costs"""
import json
import sys
from pathlib import Path

# Load measured costs
cost_path = Path(__file__).resolve().parent.parent.parent / "v3" / "../cost_estimates.json"
if not cost_path.exists():
    cost_path = Path(__file__).resolve().parent.parent.parent.parent / "cost_estimates.json"
    
with open(cost_path) as f:
    COSTS = json.load(f)

def dry_run_s1(stage="main"):
    """Study 1: benef control, 4 arms, 48 per arm per model (main) or 16 (canary)"""
    n_per_arm = 48 if stage == "main" else 16
    n_arms = 4
    
    print(f"\n=== Study 1 ({stage}): Beneficiary Control ===")
    print(f"Design: 4 arms × {n_per_arm} per arm per model = {n_arms * n_per_arm} units per model")
    print(f"Cues: benef_org, benef_self, benef_other, none")
    print()
    
    total_cost = 0.0
    for model in ["claude-haiku-5.5", "gpt-oss-120b", "qwen3.6-27b", "gemini-3.8-flash"]:
        # Use study1_unit cost (includes target, graders, probe, trace graders)
        unit_cost = COSTS["per_unit_usd"][model]["study1_unit"]
        model_cost = n_arms * n_per_arm * unit_cost
        total_cost += model_cost
        print(f"  {model:20s}: {n_arms * n_per_arm:3d} units × ${unit_cost:.6f} = ${model_cost:.4f}")
    
    expected = total_cost
    with_margin = total_cost * COSTS["margin"]
    
    print(f"\n  Expected cost: ${expected:.2f}")
    print(f"  With {COSTS['margin']}× margin: ${with_margin:.2f}")
    print(f"  Preregistered {'cap' if stage == 'main' else 'canary cap'}: ${'8.92' if stage == 'main' else '2.97'}")
    
    return expected, with_margin

def dry_run_s2(stage="main"):
    """Study 2: role×tools 2x2, 4 cells, 48 per cell per model (main) or 16 (canary)"""
    n_per_cell = 48 if stage == "main" else 16
    n_cells = 4
    
    print(f"\n=== Study 2 ({stage}): Role × Tools ===")
    print(f"Design: 4 cells × {n_per_cell} per cell per model = {n_cells * n_per_cell} units per model")
    print(f"Cells: agent_tools, agent_notools, advisor_tools, advisor_notools")
    print()
    
    total_cost = 0.0
    for model in ["claude-haiku-5.5", "gpt-oss-120b", "qwen3.6-27b", "gemini-3.8-flash"]:
        # Study 2: weighted average of tool and notool costs
        # 2 tools cells + 2 notools cells
        tool_cost = COSTS["per_unit_usd"][model]["study2_tool_unit"]
        notool_cost = COSTS["per_unit_usd"][model]["study2_notool_unit"]
        
        # 2 tools cells × n + 2 notools cells × n
        model_cost = 2 * n_per_cell * tool_cost + 2 * n_per_cell * notool_cost
        total_cost += model_cost
        print(f"  {model:20s}: {n_cells * n_per_cell:3d} units (2×{n_per_cell} tools + 2×{n_per_cell} notools) = ${model_cost:.4f}")
    
    expected = total_cost
    with_margin = total_cost * COSTS["margin"]
    
    print(f"\n  Expected cost: ${expected:.2f}")
    print(f"  With {COSTS['margin']}× margin: ${with_margin:.2f}")
    print(f"  Preregistered {'cap' if stage == 'main' else 'canary cap'}: ${'4.21' if stage == 'main' else '1.40'}")
    
    return expected, with_margin

def main():
    if len(sys.argv) > 1 and sys.argv[1] in ["--help", "-h"]:
        print("Usage: python dry_run.py")
        print("Shows projected costs for preregistered studies S1 and S2")
        return
    
    print("=" * 70)
    print("PREREGISTERED STUDIES S1 & S2: DRY-RUN COST PROJECTIONS")
    print("Based on measured per-unit costs from v3final")
    print("=" * 70)
    
    # Study 1
    s1_canary_exp, s1_canary_cap = dry_run_s1("canary")
    s1_main_exp, s1_main_cap = dry_run_s1("main")
    
    # Study 2
    s2_canary_exp, s2_canary_cap = dry_run_s2("canary")
    s2_main_exp, s2_main_cap = dry_run_s2("main")
    
    # Totals
    print("\n" + "=" * 70)
    print("COMBINED TOTALS")
    print("=" * 70)
    
    print(f"\nStudy 1:")
    print(f"  Canary: ${s1_canary_exp:.2f} expected, ${s1_canary_cap:.2f} at 1.5×")
    print(f"  Main:   ${s1_main_exp:.2f} expected, ${s1_main_cap:.2f} at 1.5×")
    print(f"  Total:  ${s1_canary_exp + s1_main_exp:.2f} expected, ${s1_canary_cap + s1_main_cap:.2f} cap")
    
    print(f"\nStudy 2:")
    print(f"  Canary: ${s2_canary_exp:.2f} expected, ${s2_canary_cap:.2f} at 1.5×")
    print(f"  Main:   ${s2_main_exp:.2f} expected, ${s2_main_cap:.2f} at 1.5×")
    print(f"  Total:  ${s2_canary_exp + s2_main_exp:.2f} expected, ${s2_canary_cap + s2_main_cap:.2f} cap")
    
    print(f"\nBoth Studies Combined:")
    total_exp = s1_canary_exp + s1_main_exp + s2_canary_exp + s2_main_exp
    total_cap = s1_canary_cap + s1_main_cap + s2_canary_cap + s2_main_cap
    print(f"  Expected: ${total_exp:.2f}")
    print(f"  With margin: ${total_cap:.2f}")
    print(f"  Combined hard cap: $17.50")
    print(f"  Remaining headroom: ${17.50 - total_cap:.2f}")
    
    print(f"\nGlobal ledger status:")
    print(f"  Committed (from cost_estimates.json): ${COSTS.get('committed_global_usd', COSTS['combined_base'].get('committed', 50.04)):.2f}")
    print(f"  Remaining: ${COSTS.get('remaining_global_usd', 19.96):.2f}")
    print(f"  After both studies: ${COSTS.get('remaining_global_usd', 19.96) - total_cap:.2f}")

if __name__ == "__main__":
    main()
