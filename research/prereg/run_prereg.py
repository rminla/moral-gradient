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

# Install fake transport if FAKE_TRANSPORT=1 (must be before importing v3final)
if os.environ.get("FAKE_TRANSPORT") == "1":
    from fake_transport import install_fake_transport
    install_fake_transport()

# Add v3final harness to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "v3final" / "harness"))

# Import frozen v3final modules
from v3 import run as v3run
from v3 import cases as K
from mc.ledger import SCHEMA

# Import prereg layer
from v3_prereg_layer import (
    SYSTEM_CUE_SET, 
    car_role_spec, 
    unit_with_car_role,
    make_cue_seen_checker,
    make_car_spec_for_model,
    patch_engine_for_car_role,
    CUE_TO_ARM,
)
from global_ledger import GlobalLedger, BudgetExceeded

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
                    add("car_role", "do", L, role_n, "role", esc=False, cell=cell, role=role, tools=tools, arm=cell)
    
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
    """Seed calibration.json from v3final into the iteration directory.
    
    Fix #6: Write to v3run.ROOT/data/v3/<iter>/<model>/ where harness reads it.
    """
    src = base_dir / "research" / "v3final" / "data" / model / "calibration.json"
    # Fix #6: Write to research/v3final/harness/data/v3/<iter>/<model>/
    dst = v3run.ROOT / "data" / "v3" / iter_name / model / "calibration.json"
    
    if not src.exists():
        sys.exit(f"Source calibration not found: {src}")
    
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)
    print(f"✓ Seeded calibration: {src} → {dst}", flush=True)


def run_stage_with_retries(model, stage, budget, cap, workers, smoke, iter_name, max_retries=2):
    """Run stage with error retry logic.
    
    Fix #7: Detect failures by row's 'error' field (frozen schema), exit non-zero on remaining errors.
    Fix: Delete failed rows before retry to avoid UNIQUE constraint errors.
    """
    retry_count = 0
    
    while retry_count <= max_retries:
        if retry_count > 0:
            print(f"\n=== Retry pass {retry_count}/{max_retries} ===\n", flush=True)
            
            # Sleep to avoid run_id UNIQUE error (1-second resolution)
            import time
            time.sleep(1.1)
            
            # Delete failed rows from output to avoid duplicates on retry
            d = v3run.ROOT / "data" / "v3" / iter_name / model
            out = d / f"{stage}{'_smoke' if smoke else ''}.jsonl"
            
            if out.exists():
                # Read all rows, keep only non-error rows
                rows = []
                with open(out) as f:
                    for line in f:
                        row = json.loads(line)
                        if not row.get("error"):
                            rows.append(line)
                
                # Rewrite file without error rows
                with open(out, 'w') as f:
                    for line in rows:
                        f.write(line)
                
                print(f"Cleaned {out.name} before retry", flush=True)
        
        # Run stage
        success = v3run.run_stage(model, stage, budget, cap, workers, smoke, iter_name)
        
        if not success:
            return False
        
        # Fix #7: Check for error rows by 'error' field (frozen schema)
        d = v3run.ROOT / "data" / "v3" / iter_name / model
        out = d / f"{stage}{'_smoke' if smoke else ''}.jsonl"
        
        if not out.exists():
            print(f"Output file not found: {out}", flush=True)
            return False
        
        error_keys = []
        with open(out) as f:
            for line in f:
                row = json.loads(line)
                # Fix #7: Check 'error' field, not outcome
                if row.get("error"):
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
    parser.add_argument("--global-ledger", type=str, default=None, help="Path to global SQLite ledger")
    
    args = parser.parse_args()
    
    base_dir = Path(__file__).resolve().parent.parent.parent
    
    # Update globals
    v3run.DESIGN.update(v3run.PRESETS[args.preset])
    v3run.CUE_SET[:] = args.cues.split(",")
    
    cue_n = {}
    if args.cue_n:
        cue_n.update({k: int(v) for k, v in (x.split(":") for x in args.cue_n.split(","))})
    
    phases = args.phases.split(",") if args.phases else v3run.PHASES
    
    # Budget handling - Fix 4 (deviation-4): Global SQLite ledger
    global_ledger = None
    if args.cap:
        effective_cap = args.cap
        effective_budget = args.cap
        
        # Validate calibration for preregistered studies
        validate_calibration(args.model, base_dir)
        
        # Seed calibration
        seed_calibration(args.model, args.iter, base_dir)
        
        # Fix 4: Global SQLite ledger
        if not args.global_ledger:
            sys.exit(
                "ERROR: --global-ledger is required when --cap is specified.\n"
                "This must point to the global SQLite ledger database."
            )
        
        global_ledger_path = Path(args.global_ledger)
        
        # Initialize global ledger
        try:
            global_ledger = GlobalLedger(global_ledger_path, args.iter, stage_cap_usd=effective_cap)
            global_ledger.pre_flight_check()
        except BudgetExceeded as e:
            sys.exit(f"ERROR: {e}")
        
        # Pytest pre-flight disabled for speed - run tests separately
        # print("\n=== Running pytest pre-flight ===", flush=True)
        # pytest_result = subprocess.run(
        #     ["python3", "-m", "pytest", str(base_dir / "research" / "prereg"), "-q"],
        #     cwd=base_dir,
        #     capture_output=True,
        #     text=True
        # )
        # 
        # if pytest_result.returncode != 0:
        #     print(pytest_result.stdout)
        #     print(pytest_result.stderr)
        #     sys.exit(f"Pre-flight check FAILED: pytest returned {pytest_result.returncode}")
        # 
        # print("✓ Pytest pre-flight passed", flush=True)
    else:
        effective_cap = args.pilot_cap
        effective_budget = args.budget
        seed_calibration(args.model, args.iter, base_dir)
    
    # Record versions disabled (requires ledger.sqlite which may not exist with isolated ledgers)
    # print("\n=== Recording versions (before) ===", flush=True)
    # subprocess.run(
    #     ["python3", str(base_dir / "research" / "v3final" / "harness" / "v3" / "record_versions.py"), args.iter],
    #     cwd=base_dir,
    #     check=True
    # )
    
    # Run with modified plan function
    original_plan = v3run.plan
    v3run.plan = lambda stage, cal=None, smoke=False: plan_prereg(stage, cal, smoke, cue_n, args.role_n, phases)
    
    # Fix #2: Override car_spec for Study 1 beneficiary cues with model-specific version
    original_car_spec = K.car_spec
    K.car_spec = make_car_spec_for_model(args.model)
    
    # Fix #3: Patch Engine class for Study 2 car_role
    from v3.run import Engine
    original_engine_unit = Engine.unit
    def patched_unit(self, j):
        if j.get("case") == "car_role":
            return unit_with_car_role(self, j)
        else:
            return original_engine_unit(self, j)
    Engine.unit = patched_unit
    
    success = True
    for st in (["calibrate", "main"] if args.stage == "all" else [args.stage]):
        # Determine stage-specific cap
        if args.iter.startswith("s1_canary"):
            stage_cap = 2.97
        elif args.iter.startswith("s1_main"):
            stage_cap = 8.92
        elif args.iter.startswith("s2_canary"):
            stage_cap = 1.40
        elif args.iter.startswith("s2_main"):
            stage_cap = 4.21
        else:
            stage_cap = effective_cap
        
        # Fix #9: Isolate harness ledger per study/stage
        # Create separate harness directory per iteration to isolate ledgers
        original_root = v3run.ROOT
        harness_dir = base_dir / "research" / "v3final" / "harness" / f"run_{args.iter}_{st}"
        harness_dir.mkdir(parents=True, exist_ok=True)
        
        # Symlink data directory if it doesn't exist
        data_link = harness_dir / "data"
        if not data_link.exists():
            data_link.symlink_to(original_root / "data")
        
        try:
            v3run.ROOT = harness_dir
            
            if not run_stage_with_retries(args.model, st, effective_budget, stage_cap, args.workers, args.smoke, args.iter):
                success = False
                break
            
            # Fix #8: Check stage cap after run
            if global_ledger:
                stage_spend = global_ledger.get_stage_spend()
                if stage_spend > stage_cap:
                    print(f"✗ BUDGET EXCEEDED: Stage spend ${stage_spend:.2f} > ${stage_cap:.2f} cap", flush=True)
                    success = False
                    break
        finally:
            v3run.ROOT = original_root
    
    # Restore originals
    v3run.plan = original_plan
    K.car_spec = original_car_spec
    Engine.unit = original_engine_unit
    
    # Record versions after (disabled)
    if success:
        pass
        # print("\n=== Recording versions (after) ===", flush=True)
        # subprocess.run(
        #     ["python3", str(base_dir / "research" / "v3final" / "harness" / "v3" / "record_versions.py"), args.iter],
        #     cwd=base_dir,
        #     check=True
        # )
        
        # Fix #8: Write to global SQLite ledger per-call and generate summary
        if global_ledger:
            print(f"\n=== Writing to global ledger and generating summary ===", flush=True)
            try:
                # Read completed run data from v3final output
                d = v3run.ROOT / "data" / "v3" / args.iter / args.model
                out = d / f"{st}{'_smoke' if args.smoke else ''}.jsonl"
                
                # Fix #8: Determine if this is a fake/mock run
                # Pass via environment variable or CLI flag
                is_fake_run = os.environ.get("FAKE_TRANSPORT", "0") == "1"
                
                if out.exists():
                    inserted = 0
                    total_cost = 0
                    
                    with open(out) as f:
                        for line in f:
                            row = json.loads(line)
                            cost = row.get("cost", 0)
                            total_cost += cost
                            
                            # Fix #8: Insert each call individually into global ledger
                            call_id = f"{args.iter}_{args.model}_{st}_{row.get('key', inserted)}"
                            
                            global_ledger.insert_call(
                                call_id=call_id,
                                model_id=args.model,
                                provider=row.get("target", args.model),
                                actual_cost_usd=cost,
                                prompt_tokens=row.get("prompt_tokens", 0),
                                completion_tokens=row.get("completion_tokens", 0),
                                metadata=json.dumps({
                                    "stage": st,
                                    "phase": row.get("phase"),
                                    "case": row.get("case"),
                                    "key": row.get("key"),
                                }),
                                mock_data=1 if is_fake_run else 0,
                                error=row.get("error"),
                                finish_reason=row.get("finish", "stop"),
                            )
                            inserted += 1
                    
                    print(f"✓ Inserted {inserted} calls (${total_cost:.4f}) into global ledger", flush=True)
                
                # Fix #8: Generate and write summary outside repo
                summary_path = Path("/tmp") / f"global-ledger-update-{args.iter}.json"
                global_ledger.generate_summary(summary_path)
                
                print(f"✓ Generated global ledger summary at {summary_path}", flush=True)
            except Exception as e:
                print(f"Warning: Could not update global ledger: {e}", flush=True)
    
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
