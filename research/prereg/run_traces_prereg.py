#!/usr/bin/env python3
"""Reasoning-trace grading for a preregistered Study 1 run (prereg secondary measure).

Runs the frozen v3/traces.py grader on the isolated harness dir that run_prereg.py wrote
(research/v3final/harness/run_<iter>_main), with every grader call reserved and recorded in the
global ledger under the same experiment (so it counts against the same stage cap).

Usage: python3 research/prereg/run_traces_prereg.py <iter> --cap 2.97 --global-ledger <db> [--models m1,m2]
"""
import argparse, os, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
if os.environ.get("FAKE_TRANSPORT") == "1":
    import fake_transport  # noqa: F401  (installs itself)
sys.path.insert(0, str(HERE.parent / "v3final" / "harness"))
from v3 import traces as T
from global_ledger import GlobalLedger, BudgetExceeded
from ledger_wrapper import install_ledger_wrapper


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("iter")
    ap.add_argument("--cap", type=float, required=True)
    ap.add_argument("--global-ledger", required=True)
    ap.add_argument("--models", default=None)
    ap.add_argument("--workers", type=int, default=8)
    a = ap.parse_args()
    real = Path(os.environ.get("PREREG_REAL_LEDGER", "/workspace/moral-compass/runs/v4-20261108/ledger.db"))
    if os.environ.get("FAKE_TRANSPORT") == "1" and real.exists() and Path(a.global_ledger).resolve() == real.resolve():
        sys.exit("ERROR: FAKE_TRANSPORT=1 must not write to the real global ledger; pass a copy.")
    root = HERE.parent / "v3final" / "harness" / f"run_{a.iter}_main"
    if not (root / "data" / "v3" / a.iter).is_dir():
        sys.exit(f"ERROR: no run data at {root}/data/v3/{a.iter}")
    try:
        gl = GlobalLedger(Path(a.global_ledger), a.iter, stage_cap_usd=a.cap)
        gl.pre_flight_check()
    except BudgetExceeded as e:
        sys.exit(f"ERROR: {e}")
    install_ledger_wrapper(gl, a.cap, a.iter, os.environ.get("FAKE_TRANSPORT") == "1")
    T.ROOT = root
    models = a.models.split(",") if a.models else None
    T.run_grade([a.iter], models, budget=a.cap, cap=a.cap, workers=a.workers, limit=None)
    gl.generate_summary(Path("/tmp") / f"global-ledger-update-{a.iter}-traces.json")


if __name__ == "__main__":
    main()
