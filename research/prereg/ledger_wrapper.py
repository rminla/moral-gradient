"""Per-call global-ledger mirror for the frozen v3final harness.

Wraps mc.ledger.Ledger.reserve/release/record (the harness's own per-call
accounting), so every harness call is reserved in the global ledger before it is
sent and inserted+reconciled with the harness's actual cost_usd afterwards.
A global/stage cap breach raises the harness's own BudgetExceeded, which makes
run_stage hard-stop cleanly.
"""
import json
import sys
import threading
from pathlib import Path

_ledger_lock = threading.Lock()


def install_ledger_wrapper(global_ledger, stage_cap_usd, experiment, is_fake_transport=False):
    harness_path = Path(__file__).resolve().parent.parent / "v3final" / "harness"
    if str(harness_path) not in sys.path:
        sys.path.insert(0, str(harness_path))
    from mc import ledger as ML

    global_ledger.stage_cap_usd = float(stage_cap_usd)
    global_ledger.experiment = experiment
    orig_reserve, orig_release, orig_record = ML.Ledger.reserve, ML.Ledger.release, ML.Ledger.record

    def reserve(self, est_usd):
        rid = orig_reserve(self, est_usd)          # harness caps first
        with _ledger_lock:
            try:
                global_ledger.reserve(call_id=rid, model_id="pending", provider="pending", estimated_usd=est_usd)
            except Exception as e:
                orig_release(self, rid)
                raise ML.BudgetExceeded(f"global ledger: {e}")
        return rid

    def release(self, rid):
        orig_release(self, rid)
        with _ledger_lock:
            global_ledger.release(rid)

    def record(self, rid, **row):
        call_id = orig_record(self, rid, **row)
        err = row.get("error")
        with _ledger_lock:
            global_ledger.insert_call(
                call_id=rid,
                model_id=row.get("model_requested", ""),
                provider=row.get("provider", ""),
                actual_cost_usd=float(row.get("cost_usd") or 0.0),
                prompt_tokens=int(row.get("input_tokens") or 0),
                completion_tokens=int(row.get("output_tokens") or 0),
                duration_ms=row.get("latency_ms"),
                metadata=json.dumps({"harness_call_id": call_id, "run_id": self.run_id,
                                     "module": row.get("module"), "role": row.get("role")}),
                mock_data=1 if is_fake_transport else 0,
                error=err if isinstance(err, str) else (json.dumps(err) if err else None),
            )
        return call_id

    ML.Ledger.reserve, ML.Ledger.release, ML.Ledger.record = reserve, release, record
    print("✓ Ledger wrapper installed: per-call reserve/insert/reconcile via mc.ledger.Ledger", flush=True)
