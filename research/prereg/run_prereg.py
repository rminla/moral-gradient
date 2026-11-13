#!/usr/bin/env python3
"""Preregistered studies runner - wraps frozen v3final harness.

This module extends the frozen v3final harness with Study 1 and Study 2 specific code
while keeping the vendored v3final/ directory byte-identical to MANIFEST.sha256.
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

# Add v3final harness to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "v3final" / "harness"))

# Import frozen v3final modules
from v3 import run as v3run
from v3 import cases as K
from mc.ledger import SCHEMA

# Import prereg layer
from v3_prereg_layer import (
    BENEF_CUES, 
    SYSTEM_CUE_SET, 
    car_spec_prereg, 
    car_role_spec, 
    unit_with_car_role,
    make_cue_seen_checker
)

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
            # Fix 2: si must be defined before use
            si = cal["car_si"]["levels"]
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


def validate_calibration(model, base_dir):
    """Validate calibration levels match v3final expectations."""
    expected_levels = {
        "claude-haiku-5.5": [4, 5],
        "gpt-oss-120b": [1, 2],
        "qwen3.6-27b": [2, 3],
        "gemini-3.8-flash": [2, 3],
    }
    
    if model not in expected_levels:
        sys.exit(f"Unknown model: {model}")
    
    # Read calibration from v3final
    cal_file = base_dir / "research" / "v3final" / "data" / model / "calibration.json"
    if not cal_file.exists():
        sys.exit(f"Calibration file not found: {cal_file}")
    
    cal = json.loads(cal_file.read_text())
    actual_levels = cal["car_si"]["levels"]
    
    if actual_levels != expected_levels[model]:
        sys.exit(
            f"Calibration validation FAILED for {model}:\n"
            f"  Expected levels: {expected_levels[model]}\n"
            f"  Actual levels: {actual_levels}\n"
            f"  The frozen v3final calibration must be used."
        )
    print(f"✓ Calibration validated: {model} levels {actual_levels}", flush=True)


def seed_calibration(model, iter_name, base_dir):
    """Seed calibration.json from v3final into the iteration directory."""
    src = base_dir / "research" / "v3final" / "data" / model / "calibration.json"
    dst = base_dir / "data" / "v3" / iter_name / model / "calibration.json"
    
    if not src.exists():
        sys.exit(f"Source calibration not found: {src}")
    
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)
    print(f"✓ Seeded calibration: {src} → {dst}", flush=True)


def run_stage_with_retries(model, stage, budget, cap, workers, smoke, iter_name, global_ledger_path=None, max_retries=2):
    """Run stage with error retry logic.
    
    Fix 4: Error rows fail the run, with 2 retry passes for errored keys only.
    """
    import threading
    from concurrent.futures import ThreadPoolExecutor
    
    # Call frozen v3final run_stage (7 args only)
    retry_count = 0
    
    while retry_count <= max_retries:
        if retry_count > 0:
            print(f"\n=== Retry pass {retry_count}/{max_retries} ===\n", flush=True)
        
        # Run stage
        success = v3run.run_stage(model, stage, budget, cap, workers, smoke, iter_name)
        
        if not success:
            return False
        
        # Check for error rows
        d = v3run.ROOT / "data" / "v3" / iter_name / model
        out = d / f"{stage}{'_smoke' if smoke else ''}.jsonl"
        
        if not out.exists():
            print(f"Output file not found: {out}", flush=True)
            return False
        
        error_keys = []
        with open(out) as f:
            for line in f:
                row = json.loads(line)
                if row.get("outcome") == "error":
                    error_keys.append(row.get("key"))
        
        if not error_keys:
            print(f"✓ Stage completed with 0 errors", flush=True)
            return True
        
        if retry_count >= max_retries:
            print(f"\n✗ Stage FAILED: {len(error_keys)} error rows remain after {max_retries} retries", flush=True)
            return False
        
        print(f"Found {len(error_keys)} error rows, preparing retry pass {retry_count + 1}...", flush=True)
        
        # For retry: v3final automatically skips completed keys
        retry_count += 1
    
    return False


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
    
    base_dir = Path(__file__).resolve().parent.parent.parent
    
    # Update globals
    v3run.DESIGN.update(v3run.PRESETS[args.preset])
    v3run.CUE_SET[:] = args.cues.split(",")
    
    cue_n = {}
    if args.cue_n:
        cue_n.update({k: int(v) for k, v in (x.split(":") for x in args.cue_n.split(","))})
    
    phases = args.phases.split(",") if args.phases else v3run.PHASES
    
    # Budget handling - Fix 3: Global ledger pre-flight
    global_ledger_path = None
    if args.cap:
        effective_cap = args.cap
        effective_budget = args.cap
        
        # Validate calibration for preregistered studies
        validate_calibration(args.model, base_dir)
        
        # Seed calibration
        seed_calibration(args.model, args.iter, base_dir)
        
        # Fix 3: Pre-flight check on global JSON ledger
        ledger_path_str = os.environ.get("GLOBAL_LEDGER_PATH")
        if not ledger_path_str:
            sys.exit(
                "Pre-flight check FAILED: GLOBAL_LEDGER_PATH environment variable not set.\n"
                "This must point to the global research ledger JSON file."
            )
        
        global_ledger_path = Path(ledger_path_str)
        
        if not global_ledger_path.exists():
            sys.exit(
                f"Pre-flight check FAILED: Global research ledger not found at {global_ledger_path}"
            )
        
        # Read JSON ledger
        try:
            ledger_data = json.loads(global_ledger_path.read_text())
        except Exception as e:
            sys.exit(f"Pre-flight check FAILED: Cannot read global ledger: {e}")
        
        # Calculate committed spend
        committed = sum(
            entry.get("cost_usd", 0) 
            for entry in ledger_data.get("entries", [])
        )
        
        if committed + effective_cap > 70.0:
            sys.exit(
                f"Pre-flight check FAILED: committed ${committed:.2f} + cap ${effective_cap:.2f} > $70.00"
            )
        
        print(f"✓ Pre-flight passed: ${committed:.2f} committed + ${effective_cap:.2f} cap = ${committed + effective_cap:.2f} <= $70.00", flush=True)
        
        # Fix 5: Run pytest pre-flight
        print("\n=== Running pytest pre-flight ===", flush=True)
        pytest_result = subprocess.run(
            ["python", "-m", "pytest", str(base_dir / "research" / "prereg"), "-v"],
            cwd=base_dir,
            capture_output=True,
            text=True
        )
        
        if pytest_result.returncode != 0:
            print(pytest_result.stdout)
            print(pytest_result.stderr)
            sys.exit(f"Pre-flight check FAILED: pytest returned {pytest_result.returncode}")
        
        print("✓ Pytest pre-flight passed", flush=True)
    else:
        effective_cap = args.pilot_cap
        effective_budget = args.budget
        seed_calibration(args.model, args.iter, base_dir)
    
    # Fix 5: Record versions before
    print("\n=== Recording versions (before) ===", flush=True)
    subprocess.run(
        ["python", str(base_dir / "research" / "v3final" / "harness" / "v3" / "record_versions.py"), args.iter],
        cwd=base_dir,
        check=True
    )
    
    # Run with modified plan function
    original_plan = v3run.plan
    v3run.plan = lambda stage, cal=None, smoke=False: plan_prereg(stage, cal, smoke, cue_n, args.role_n, phases)
    
    # Override car_spec for beneficiary cues
    original_car_spec = K.car_spec
    K.car_spec = car_spec_prereg
    
    success = True
    for st in (["calibrate", "main"] if args.stage == "all" else [args.stage]):
        if not run_stage_with_retries(args.model, st, effective_budget, effective_cap, args.workers, args.smoke, args.iter, global_ledger_path):
            success = False
            break
    
    # Restore originals
    v3run.plan = original_plan
    K.car_spec = original_car_spec
    
    # Fix 5: Record versions after
    if success:
        print("\n=== Recording versions (after) ===", flush=True)
        subprocess.run(
            ["python", str(base_dir / "research" / "v3final" / "harness" / "v3" / "record_versions.py"), args.iter],
            cwd=base_dir,
            check=True
        )
        
        # Fix 3: Write back to global ledger
        if global_ledger_path:
            print(f"\n=== Writing back to global ledger ===", flush=True)
            try:
                # Read current ledger
                ledger_data = json.loads(global_ledger_path.read_text())
                
                # Read completed run data
                d = v3run.ROOT / "data" / "v3" / args.iter / args.model
                out = d / f"{st}{'_smoke' if args.smoke else ''}.jsonl"
                
                total_cost = 0
                if out.exists():
                    with open(out) as f:
                        for line in f:
                            row = json.loads(line)
                            total_cost += row.get("cost_usd", 0)
                
                # Append entry
                if "entries" not in ledger_data:
                    ledger_data["entries"] = []
                
                ledger_data["entries"].append({
                    "iter": args.iter,
                    "model": args.model,
                    "stage": st,
                    "cost_usd": total_cost,
                    "timestamp": v3run.now_local(),
                })
                
                # Write back
                global_ledger_path.write_text(json.dumps(ledger_data, indent=2))
                print(f"✓ Wrote ${total_cost:.4f} to global ledger", flush=True)
            except Exception as e:
                print(f"Warning: Could not write to global ledger: {e}", flush=True)
    
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
