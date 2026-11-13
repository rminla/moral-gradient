#!/usr/bin/env python3
"""Preregistered studies runner - wraps frozen v3final harness.

This module extends the frozen v3final harness with Study 1 and Study 2 specific code
while keeping the vendored v3final/ directory byte-identical to MANIFEST.sha256.
"""
import argparse
import json
import os
import sqlite3
import sys
from pathlib import Path

# Add v3final harness to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "v3final" / "harness"))

# Import frozen v3final modules
from v3 import run as v3run
from v3 import cases as K
from mc.ledger import SCHEMA

# Preregistered Study 1: per-cue arms
CUE_ARMS = {
    "benef_org": ("incentive",),
    "benef_self": ("incentive",),
    "benef_other": ("incentive",),
    "benef_bridge": ("incentive",),
    "none": ("none",),
}

# Study 2 cell configuration (explicit mapping to avoid "tools" in "notools" bug)
CELL_CONFIG = {
    "agent_tools": ("agent", True),
    "agent_notools": ("agent", False),
    "advisor_tools": ("advisor", True),
    "advisor_notools": ("advisor", False),
}


def plan_prereg(stage, cal, smoke, cue_n, role_n, phases):
    """Generate plan with preregistered study modifications."""
    J = []
    
    def add(case, level, stakes, n, phase, **kw):
        for s in range(n):
            J.append(dict(case=case, level=level, stakes=stakes, para=s % 3, s=s, phase=phase, **kw))
    
    if stage == "calibrate":
        # Use v3final calibrate plan unchanged
        for L in K.CAR_LEVELS:
            add("car", "do", L, v3run.DESIGN["n_cal"], "cal", esc=False)
        for c in v3run.DILEMMA_SET:
            for L in K.dilemma_levels(c):
                add(c, "base", L, v3run.DESIGN["n_fb"], "ladder")
    else:
        # Main stage with prereg modifications
        if "say" in phases:
            add("car", "say", 1, v3run.DESIGN["n_say"], "say")
            add("hon", "say", 1, v3run.DESIGN["n_say"], "say")
        
        if "ladder" in phases:
            for L in K.CAR_LEVELS:
                for lv in ("judge", "ask", "do"):
                    add("car", lv, L, v3run.DESIGN["n_ladder"] if lv == "do" else v3run.DESIGN["n_judge"], "ladder", esc=True)
            for L in K.HON_AMOUNTS:
                for lv in ("judge", "ask", "do"):
                    add("hon", lv, L, v3run.DESIGN["n_ladder"] if lv == "do" else v3run.DESIGN["n_judge"], "ladder")
        
        if "si" in phases:
            si = cal["car_si"]["levels"]
            mult = 2 if len(si) == 1 else 1
            for cue in v3run.CUE_SET:
                # Use CUE_ARMS for preregistered studies
                arms = CUE_ARMS.get(cue, ("none",) if cue == "none" else ("neutral", "incentive"))
                for arm in arms:
                    n_per_level = cue_n.get(cue, v3run.DESIGN["n_si_cell"]) * mult
                    for L in si:
                        add("car", "do", L, n_per_level, "si", esc=False, cue=None if cue == "none" else cue, arm=arm)
        
        if "press" in phases:
            for c in v3run.DILEMMA_SET:
                fbL = cal[f"{c}_press"]["levels"]
                for arm in K.PRESS_ARMS:
                    for s in range(v3run.DESIGN["n_press"]):
                        J.append(dict(case=c, level="press", stakes=fbL[s % len(fbL)], para=s % 3, s=s, phase="press", arm=arm))
        
        if "role" in phases and role_n is not None:
            # Study 2: role×tools 2x2
            for cell, (role, tools) in CELL_CONFIG.items():
                for L in si:
                    add("car_role", "do", L, role_n, "role", esc=False, cell=cell, role=role, tools=tools)
    
    if smoke:
        seen, out = set(), []
        for j in J:
            k = (j["case"], j["level"], j["phase"], j.get("cue"), j.get("arm"))
            if k not in seen:
                seen.add(k)
                out.append(j)
        J = out
    
    return J


def validate_calibration(model):
    """Validate calibration levels match v3final expectations."""
    from v3.calibration_guard import get_car_si_levels
    
    expected_levels = {
        "claude-haiku-5.5": [4, 5],
        "gpt-oss-120b": [1, 2],
        "qwen3.6-27b": [2, 3],
        "gemini-3.8-flash": [2, 3],
    }
    
    if model not in expected_levels:
        sys.exit(f"Unknown model: {model}")
    
    try:
        actual_levels = get_car_si_levels(model, Path(__file__).resolve().parent.parent / "v3final")
        if actual_levels != expected_levels[model]:
            sys.exit(
                f"Calibration validation FAILED for {model}:\n"
                f"  Expected levels: {expected_levels[model]}\n"
                f"  Actual levels: {actual_levels}\n"
                f"  The frozen v3final calibration must be used."
            )
        print(f"✓ Calibration validated: {model} levels {actual_levels}", flush=True)
    except Exception as e:
        sys.exit(f"Calibration validation error: {e}")


def main():
    parser = argparse.ArgumentParser(description="Preregistered studies runner")
    parser.add_argument("model", help="Model name")
    parser.add_argument("--stage", choices=["calibrate", "main", "all"], default="all")
    parser.add_argument("--budget", type=float, required=True)
    parser.add_argument("--pilot-cap", type=float, default=85.0)
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--smoke", action="store_true")
    parser.add_argument("--iter", required=True)
    parser.add_argument("--preset", choices=list(v3run.PRESETS), default="iter")
    parser.add_argument("--cues", default="dashboard,memo,crm")
    parser.add_argument("--phases", default=None)
    parser.add_argument("--cue-n", default=None)
    parser.add_argument("--role-n", type=int, default=None)
    parser.add_argument("--cap", type=float, default=None)
    
    args = parser.parse_args()
    
    # Update globals
    v3run.DESIGN.update(v3run.PRESETS[args.preset])
    v3run.CUE_SET[:] = args.cues.split(",")
    
    cue_n = {}
    if args.cue_n:
        cue_n.update({k: int(v) for k, v in (x.split(":") for x in args.cue_n.split(","))})
    
    phases = args.phases.split(",") if args.phases else v3run.PHASES
    
    # Budget handling
    global_ledger_path = None
    if args.cap:
        effective_cap = args.cap
        effective_budget = args.cap
        
        # Validate calibration for preregistered studies
        validate_calibration(args.model)
        
        # Pre-flight check
        global_ledger_path = Path(os.environ.get("GLOBAL_LEDGER_PATH", v3run.ROOT / "data" / "global_ledger.sqlite"))
        
        if not global_ledger_path.exists():
            sys.exit(
                f"Pre-flight check FAILED: Global research ledger not found at {global_ledger_path}\n"
                f"Set GLOBAL_LEDGER_PATH environment variable."
            )
        
        conn = sqlite3.connect(str(global_ledger_path))
        committed = conn.execute("SELECT COALESCE(SUM(cost_usd), 0) FROM calls WHERE status = 'ok'").fetchone()[0]
        conn.close()
        
        if committed + effective_cap > 70.0:
            sys.exit(
                f"Pre-flight check FAILED: committed ${committed:.2f} + cap ${effective_cap:.2f} > $70.00"
            )
        
        print(f"✓ Pre-flight passed: ${committed:.2f} + ${effective_cap:.2f} = ${committed + effective_cap:.2f} <= $70.00", flush=True)
    else:
        effective_cap = args.pilot_cap
        effective_budget = args.budget
    
    # Run with modified plan function
    original_plan = v3run.plan
    v3run.plan = lambda stage, cal=None, smoke=False: plan_prereg(stage, cal, smoke, cue_n, args.role_n, phases)
    
    for st in (["calibrate", "main"] if args.stage == "all" else [args.stage]):
        if not v3run.run_stage(args.model, st, effective_budget, effective_cap, args.workers, args.smoke, args.iter, global_ledger_path):
            sys.exit(1)
    
    v3run.plan = original_plan


if __name__ == "__main__":
    main()
