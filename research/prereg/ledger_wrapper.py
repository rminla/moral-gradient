"""Runtime wrapper for ModelClient._send to enforce per-call global ledger."""
import os
import threading
import uuid
from pathlib import Path

# Thread-safe lock for ledger operations
_ledger_lock = threading.Lock()
_backup_done = False


def install_ledger_wrapper(global_ledger, stage_cap_usd, experiment, is_fake_transport=False):
    """Install per-call ledger wrapper around ModelClient._send.
    
    Args:
        global_ledger: GlobalLedger instance
        stage_cap_usd: Stage cap in USD
        experiment: Experiment name (iteration)
        is_fake_transport: Whether this is a fake transport run (mark mock_data=1)
    """
    import sys
    from pathlib import Path
    
    # Import v3.client
    harness_path = Path(__file__).resolve().parent.parent / "v3final" / "harness"
    if str(harness_path) not in sys.path:
        sys.path.insert(0, str(harness_path))
    
    import v3.client as CL
    
    # Save original _send
    original_send = CL.ModelClient._send
    
    # Import price function
    from v3.client import _price_usd_per_mtok
    
    def wrapped_send(self, body, headers, cap):
        """Wrapped _send with per-call reserve/insert."""
        global _backup_done
        
        # Generate call_id
        call_id = str(uuid.uuid4())
        
        # Estimate worst-case cost for reservation
        model = body.get("model", "unknown")
        max_tokens = body.get("max_tokens", 4096)
        
        # Get prices from harness table
        try:
            inp_price = _price_usd_per_mtok(model, input=True)
            out_price = _price_usd_per_mtok(model, input=False)
        except:
            # Fallback prices
            inp_price = 1.0
            out_price = 5.0
        
        # Estimate input tokens (rough)
        input_estimate = 2000  # Conservative estimate
        
        # Worst-case reservation
        worst_case_cost = (input_estimate * inp_price + max_tokens * out_price) / 1e6
        
        with _ledger_lock:
            # Backup DB before first write
            if not _backup_done:
                global_ledger.backup()
                _backup_done = True
            
            # Reserve
            try:
                global_ledger.reserve(
                    call_id=call_id,
                    model_id=model,
                    provider=self.p.get("api", "unknown"),
                    reserved_usd=worst_case_cost,
                    experiment=experiment,
                    stage_cap_usd=stage_cap_usd
                )
            except Exception as e:
                # Reservation failed (budget exceeded)
                raise RuntimeError(f"Global ledger reservation failed: {e}")
        
        # Call original _send
        response, delay, error = original_send(self, body, headers, cap)
        
        # Compute actual cost
        if response and hasattr(response, 'json'):
            resp_json = response.json()
            usage = resp_json.get("usage", {})
            
            # Use OpenRouter cost if available
            if "cost" in usage:
                actual_cost = usage["cost"]
            else:
                # Compute from tokens
                input_tokens = usage.get("input_tokens", 0) or usage.get("prompt_tokens", 0)
                output_tokens = usage.get("output_tokens", 0) or usage.get("completion_tokens", 0)
                actual_cost = (input_tokens * inp_price + output_tokens * out_price) / 1e6
        else:
            actual_cost = 0.0
        
        # Insert call and reconcile reservation
        with _ledger_lock:
            global_ledger.insert_call(
                call_id=call_id,
                model_id=model,
                provider=self.p.get("api", "unknown"),
                cost_usd=actual_cost,
                experiment=experiment,
                mock_data=1 if is_fake_transport else 0
            )
        
        return response, delay, error
    
    # Replace _send
    CL.ModelClient._send = wrapped_send
    
    print(f"✓ Ledger wrapper installed: per-call reserve/insert enabled")
