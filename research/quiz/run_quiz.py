#!/usr/bin/env python3
"""
Quiz comparison harness for Moral Gradient v4.

Runs 10-question quiz across 4 models with randomized option order.
"""

import argparse
import concurrent.futures
import fcntl
import hashlib
import json
import os
import random
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Set

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from lib.budget import BudgetTracker, BudgetExceededError
from lib.providers import Message, ProviderClient
from lib.models import MODELS, verify_model_availability


class CircuitBreaker:
    """
    Circuit breaker for provider errors.
    
    Disables a model after too many consecutive failures to prevent
    wasting budget on permanently broken endpoints.
    """
    def __init__(self, max_failures: int = 3):
        self.max_failures = max_failures
        self._failures: Dict[str, int] = {}
        self._disabled: Set[str] = set()
        self._lock = threading.Lock()
    
    def record_success(self, model_id: str):
        """Reset failure count on success."""
        with self._lock:
            self._failures[model_id] = 0
    
    def record_failure(self, model_id: str) -> bool:
        """
        Record failure and check if model should be disabled.
        
        Returns:
            True if model is now disabled
        """
        with self._lock:
            self._failures[model_id] = self._failures.get(model_id, 0) + 1
            if self._failures[model_id] >= self.max_failures:
                self._disabled.add(model_id)
                return True
            return False
    
    def is_disabled(self, model_id: str) -> bool:
        """Check if model is disabled."""
        with self._lock:
            return model_id in self._disabled
    
    def get_disabled(self) -> Set[str]:
        """Get set of disabled models."""
        with self._lock:
            return self._disabled.copy()


def acquire_process_lock(ledger_path: Path):
    """
    Acquire exclusive file lock to prevent concurrent processes.
    
    Returns:
        Open file handle (MUST be kept open to retain lock), or None if already locked
    
    Caller MUST keep returned file handle open for entire run lifetime!
    Closing or garbage collecting the handle releases the lock.
    """
    lock_path = ledger_path.with_suffix('.lock')
    try:
        lock_file = open(lock_path, 'w')
        fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        lock_file.write(f"{os.getpid()}\n")
        lock_file.flush()
        return lock_file  # Return file object, not fd
    except (IOError, OSError):
        return None


def load_config(config_path: Path) -> Dict:
    """Load quiz configuration."""
    with open(config_path) as f:
        return json.load(f)


def load_scenarios(scenarios_path: Path) -> Dict:
    """Load quiz scenarios."""
    with open(scenarios_path) as f:
        return json.load(f)


def generate_prompt(
    scenario: Dict,
    option_order: List[str],
    template: str
) -> str:
    """
    Generate prompt for a quiz question.
    
    Args:
        scenario: Scenario dict with text and options
        option_order: List of option IDs in order [first, second]
        template: Prompt template string
    
    Returns:
        Formatted prompt string
    """
    # Find options by ID
    options_by_id = {opt['id']: opt['label'] for opt in scenario['options']}
    
    option_a = options_by_id[option_order[0]]
    option_b = options_by_id[option_order[1]]
    
    return template.format(
        scenario_text=scenario['text'],
        option_a=option_a,
        option_b=option_b
    )


def parse_response(response_text: str) -> Optional[str]:
    """
    Parse model response to extract choice (A or B).
    
    Strict parsing: Only match explicit choices, never match letters
    inside refusals or explanations.
    
    Returns:
        'A', 'B', or None if parsing failed or refused
    """
    import re
    
    text = response_text.strip()
    
    # ANTI-PATTERN: Detect refusals first (must NOT match these)
    refusal_patterns = [
        r"I(?:'m| am) not (?:able|comfortable|willing)",
        r"cannot (?:provide|give|make|offer)",
        r"(?:refuse|decline) to",
        r"don't feel (?:comfortable|able)",
        r"would not be appropriate"
    ]
    
    for pattern in refusal_patterns:
        if re.search(pattern, text, re.IGNORECASE):
            return None  # Explicit refusal, do not parse
    
    # Pattern 1: Markdown bold **A)** or **A**
    match = re.search(r'\*\*([AB])\*\*|\*\*([AB])\)', text)
    if match:
        return (match.group(1) or match.group(2)).upper()
    
    # Pattern 2: "A)" or "B)" at start of line  
    match = re.search(r'^([AB])\)', text, re.MULTILINE)
    if match:
        return match.group(1)
    
    # Pattern 3: Lines starting with just "A" or "B" (strict)
    for line in text.split('\n')[:3]:
        line_stripped = line.strip()
        if line_stripped and line_stripped[0] in ['A', 'B']:
            # Must be: "A" alone, "A)" "A " "A." but NOT "About" "As"
            if len(line_stripped) == 1 or line_stripped[1] in [')', ' ', '.', ',', ':']:
                return line_stripped[0]
    
    # Pattern 4: "choose A", "option A" (strict word boundaries)
    match = re.search(r'\b(?:choose|option|select|pick)\s+([AB])\b', text, re.IGNORECASE)
    if match:
        return match.group(1).upper()
    
    # Pattern 5: Standalone A or B at very start (strict, case insensitive)
    if re.match(r'^[Aa][\s\.\)]', text):
        return 'A'
    if re.match(r'^[Bb][\s\.\)]', text):
        return 'B'
    
    # Pattern 6: Just "a" or "b" alone (case insensitive)
    if text.upper() == 'A':
        return 'A'
    if text.upper() == 'B':
        return 'B'
    
    return None


def map_choice_to_semantic(
    letter_choice: Optional[str],
    option_order: List[str]
) -> Optional[str]:
    """
    Map letter choice (A/B) to semantic option ID.
    
    Args:
        letter_choice: 'A', 'B', or None
        option_order: List of option IDs [first, second]
    
    Returns:
        Semantic option ID or None
    """
    if letter_choice == 'A':
        return option_order[0]
    elif letter_choice == 'B':
        return option_order[1]
    else:
        return None


def run_quiz(
    config_path: Path,
    scenarios_path: Path,
    output_dir: Path,
    budget_cap: float,
    dry_run: bool = False,
    resume_from: Optional[Path] = None,
    run_id: Optional[str] = None,
    ledger_path: Optional[Path] = None,
    max_workers: int = 4,
    http_timeout: int = 180
) -> Dict:
    """
    Run quiz comparison experiment.
    
    Args:
        config_path: Path to config.json
        scenarios_path: Path to scenarios.json
        output_dir: Directory for output manifest
        budget_cap: Budget cap in USD
        dry_run: If True, mock all API calls
        resume_from: Optional manifest to resume from
    
    Returns:
        Manifest dict with all results
    """
    # Load configuration
    config = load_config(config_path)
    scenarios_data = load_scenarios(scenarios_path)
    
    # Initialize budget tracker (use provided path or default)
    if ledger_path is None:
        ledger_path = Path(__file__).parent.parent / "ledger.db"
    
    # Acquire cross-process lock to prevent concurrent runs
    # CRITICAL: Must keep lock_file handle open for entire run
    lock_file = acquire_process_lock(ledger_path)
    if lock_file is None:
        print("\n✗ ERROR: Another process is already using this ledger")
        print(f"  Ledger: {ledger_path}")
        print("  Only one process can run at a time to ensure budget safety")
        sys.exit(1)
    
    budget_tracker = BudgetTracker(ledger_path, budget_cap)
    
    # Initialize circuit breaker
    circuit_breaker = CircuitBreaker(max_failures=3)
    
    # Initialize provider client with HTTP timeout
    provider_client = ProviderClient(
        budget_tracker=budget_tracker,
        experiment="quiz",
        dry_run=dry_run,
        http_timeout=http_timeout
    )
    
    # Check budget status
    status = budget_tracker.get_status()
    print(f"\n{'='*60}")
    print(f"Quiz Comparison - Budget Status")
    print(f"{'='*60}")
    print(f"Cap: ${status.global_cap_usd:.2f}")
    print(f"Available: ${status.global_available_usd:.2f}")
    print(f"Reserved: ${status.global_reserved_usd:.2f}")
    print(f"Spent: ${status.global_spent_usd:.2f}")
    print(f"{'='*60}\n")
    
    # Verify model availability
    print("Verifying model availability...")
    available = verify_model_availability()
    for model_id, is_available in available.items():
        status_str = "✓" if is_available else "✗"
        note = MODELS[model_id].availability_note or ""
        print(f"  {status_str} {model_id} {note}")
    print()
    
    if dry_run:
        print("⚠️  DRY RUN MODE - No actual API calls will be made\n")
    
    # Create manifest structure (use provided run_id or generate)
    if run_id is None:
        run_id = f"quiz_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
    manifest = {
        "version": "1.0.0",
        "run_id": run_id,
        "created_at": datetime.utcnow().isoformat() + "Z",
        "dry_run": dry_run,
        "config": config,
        "scenarios_version": scenarios_data["version"],
        "method_hash": compute_method_hash(config_path, scenarios_path),
        "calls": [],
        "summary": {
            "total_calls": 0,
            "valid_responses": 0,
            "invalid_responses": 0,
            "total_cost_usd": 0.0,
            "by_model": {},
            "by_scenario": {}
        }
    }
    
    # Resume handling
    completed_call_ids = set()
    if resume_from:
        print(f"Resuming from: {resume_from}")
        with open(resume_from) as f:
            prev_manifest = json.load(f)
            # Support both "calls" (checkpoint) and "results" (recovery) formats
            if "calls" in prev_manifest:
                manifest["calls"] = prev_manifest["calls"]
            elif "results" in prev_manifest:
                # Recovery format - use results as calls
                manifest["calls"] = prev_manifest["results"]
                print("  (Loaded from recovery manifest)")
            else:
                raise ValueError("Resume manifest must contain 'calls' or 'results' field")
            completed_call_ids = {call["call_id"] for call in manifest["calls"]}
        print(f"  Already completed: {len(completed_call_ids)} calls\n")
    
    # Generate call plan
    random.seed(config["randomization_seed"])
    
    call_plan = []
    for scenario in scenarios_data["scenarios"]:
        scenario_id = scenario["id"]
        option_ids = [opt["id"] for opt in scenario["options"]]
        
        for model_id in config["models"]:
            # Generate balanced randomization
            n_per = config["n_per_question"]
            n_half = n_per // 2
            
            # Half with original order, half with swapped
            orders = []
            orders.extend([option_ids] * n_half)  # Original order
            orders.extend([option_ids[::-1]] * (n_per - n_half))  # Swapped
            
            random.shuffle(orders)  # Shuffle assignment
            
            for call_idx, option_order in enumerate(orders):
                # Namespace call IDs by run to avoid collisions
                call_id = f"{run_id}_{scenario_id}_{model_id.replace('/', '_')}_{call_idx}"
                
                if call_id not in completed_call_ids:
                    call_plan.append({
                        "call_id": call_id,
                        "scenario_id": scenario_id,
                        "scenario": scenario,
                        "model_id": model_id,
                        "option_order": option_order,
                        "call_index": call_idx
                    })
    
    total_planned = len(call_plan) + len(completed_call_ids)
    print(f"Total calls planned: {total_planned}")
    print(f"Already completed: {len(completed_call_ids)}")
    print(f"Remaining: {len(call_plan)}\n")
    
    if not call_plan:
        print("No calls remaining. Run complete!")
        return manifest
    
    # Execute calls (bounded parallel execution with fair per-provider scheduling)
    print(f"\nStarting parallel execution with {max_workers} workers...\n")
    print(f"Fair scheduling: max 1 call per model in-flight\n")
    
    completed_count = 0
    manifest_lock = threading.Lock()
    budget_exceeded_flag = threading.Event()
    fatal_storage_flag = threading.Event()
    
    # Per-model semaphores for fair scheduling (max 1 concurrent per model)
    model_semaphores = {}
    for call_spec in call_plan:
        model_id = call_spec['model_id']
        if model_id not in model_semaphores:
            model_semaphores[model_id] = threading.Semaphore(1)
    
    try:
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            # Bounded submission queue - submit in batches to avoid overwhelming
            pending_futures = {}
            submitted_count = 0
            call_queue = list(call_plan)
            
            # Initial batch submission (fill worker pool)
            while len(pending_futures) < max_workers and call_queue:
                call_spec = call_queue.pop(0)
                future = executor.submit(
                    execute_quiz_call, call_spec, config, provider_client, circuit_breaker
                )
                pending_futures[future] = call_spec
                submitted_count += 1
            
            # Process completed tasks and submit new ones
            while pending_futures:
                if budget_exceeded_flag.is_set() or fatal_storage_flag.is_set():
                    # Stop submitting new work
                    break
                
                # Wait for next completion
                done, _ = concurrent.futures.wait(
                    pending_futures.keys(),
                    return_when=concurrent.futures.FIRST_COMPLETED
                )
                
                for future in done:
                    call_spec = pending_futures.pop(future)
                    
                    try:
                        call_record = future.result()
                        
                        if call_record is not None:
                            # Thread-safe manifest update
                            with manifest_lock:
                                manifest["calls"].append(call_record)
                                
                                # Update summary
                                manifest["summary"]["total_calls"] += 1
                                if call_record["response_parsed"]["valid"]:
                                    manifest["summary"]["valid_responses"] += 1
                                else:
                                    manifest["summary"]["invalid_responses"] += 1
                                manifest["summary"]["total_cost_usd"] += call_record["cost_usd"]
                                
                                completed_count += 1
                                
                                # Checkpoint every 10 calls
                                if completed_count % 10 == 0:
                                    checkpoint_path = output_dir / f"{run_id}_checkpoint.json"
                                    with open(checkpoint_path, 'w') as f:
                                        json.dump(manifest, f, indent=2)
                                    print(f"  💾 Checkpoint saved: {checkpoint_path.name} ({completed_count} calls)")
                    
                    except BudgetExceededError as e:
                        print(f"\n⚠️  BUDGET EXCEEDED: {e}")
                        print(f"Stopping dispatch at {completed_count}/{len(call_plan)} completed")
                        budget_exceeded_flag.set()
                        # Cancel remaining futures
                        for f in pending_futures:
                            f.cancel()
                        break
                    except RuntimeError as e:
                        if "FATAL: Ledger write failed" in str(e):
                            print(f"\n⚠️  FATAL STORAGE ERROR: {e}")
                            print(f"Stopping dispatch, draining in-flight, preserving held costs")
                            fatal_storage_flag.set()
                            # Cancel queued futures (not yet running)
                            for f in pending_futures:
                                f.cancel()
                            break
                        else:
                            print(f"  ✗ Unexpected runtime error: {e}")
                            import traceback
                            traceback.print_exc()
                    except Exception as e:
                        print(f"  ✗ Unexpected error in worker: {e}")
                        import traceback
                        traceback.print_exc()
                
                # Submit next batch if space available and work remains
                while len(pending_futures) < max_workers and call_queue and not budget_exceeded_flag.is_set() and not fatal_storage_flag.is_set():
                    call_spec = call_queue.pop(0)
                    future = executor.submit(
                        execute_quiz_call, call_spec, config, provider_client, circuit_breaker
                    )
                    pending_futures[future] = call_spec
                    submitted_count += 1
            
            # Wait for any remaining in-flight work to complete
            executor.shutdown(wait=True)
    
    except KeyboardInterrupt:
        print("\n\n⚠️  Interrupted by user")
        print("Waiting for in-flight calls to complete...")
    
    # Report circuit breaker status
    disabled = circuit_breaker.get_disabled()
    if disabled:
        print(f"\n⚠️  Circuit breaker disabled models: {', '.join(disabled)}")
    
    if fatal_storage_flag.is_set():
        print(f"\n⚠️  Run stopped due to fatal storage error")
        print(f"  Completed: {completed_count} calls")
        print(f"  In-flight reservations preserved for recovery")
    
    # Compute final summary
    compute_summary(manifest)
    
    # Save final manifest
    output_path = output_dir / f"{run_id}.json"
    with open(output_path, 'w') as f:
        json.dump(manifest, f, indent=2)
    
    print(f"\n{'='*60}")
    print(f"Quiz Complete")
    print(f"{'='*60}")
    print(f"Total calls: {manifest['summary']['total_calls']}")
    print(f"Valid responses: {manifest['summary']['valid_responses']}")
    print(f"Invalid responses: {manifest['summary']['invalid_responses']}")
    print(f"Total cost: ${manifest['summary']['total_cost_usd']:.4f}")
    print(f"Manifest: {output_path}")
    print(f"{'='*60}\n")
    
    # Release process lock before return
    lock_file.close()
    
    return manifest


def execute_quiz_call(
    call_spec: Dict,
    config: Dict,
    provider_client: ProviderClient,
    circuit_breaker: CircuitBreaker
) -> Optional[Dict]:
    """
    Execute a single quiz call (worker function for parallel execution).
    
    Returns:
        Call record dict if successful, None if should skip
    
    Raises:
        BudgetExceededError: If budget exceeded (should stop all workers)
        Exception: On permanent failures (logged but execution continues)
    """
    model_id = call_spec['model_id']
    
    # Check circuit breaker
    if circuit_breaker.is_disabled(model_id):
        print(f"  ⊗ {model_id} DISABLED (circuit breaker)")
        return None
    
    try:
        # Generate prompt
        prompt = generate_prompt(
            call_spec['scenario'],
            call_spec['option_order'],
            config['prompt_template']
        )
        
        prompt_hash = hashlib.sha256(prompt.encode()).hexdigest()
        
        messages = [Message(role="user", content=prompt)]
        
        # Make call
        response = provider_client.call_model(
            call_id=call_spec['call_id'],
            model_id=model_id,
            messages=messages,
            max_tokens=config['sampling']['max_tokens'],
            temperature=config['sampling']['temperature'],
            metadata={
                "scenario_id": call_spec['scenario_id'],
                "option_order": call_spec['option_order']
            }
        )
        
        # Parse response
        letter_choice = parse_response(response.content)
        semantic_choice = map_choice_to_semantic(
            letter_choice,
            call_spec['option_order']
        )
        
        valid = letter_choice is not None
        truncated = (response.finish_reason in ("length", "max_tokens")) if response.finish_reason else False
        
        # Record success in circuit breaker
        circuit_breaker.record_success(model_id)
        
        # Build call record (preserve FULL raw text, no truncation)
        call_record = {
            "call_id": call_spec['call_id'],
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "model_id": model_id,
            "model_version": response.model_version,
            "scenario_id": call_spec['scenario_id'],
            "option_order": call_spec['option_order'],
            "prompt_hash": prompt_hash,
            "response_raw": response.content,  # FULL TEXT, no truncation
            "response_parsed": {
                "letter_choice": letter_choice,
                "semantic_choice": semantic_choice,
                "valid": valid
            },
            "usage": response.usage,
            "cost_usd": response.actual_cost_usd,
            "duration_ms": response.duration_ms,
            "finish_reason": response.finish_reason,
            "truncated": truncated
        }
        
        print(f"  → {letter_choice or 'INVALID'} ({semantic_choice or 'N/A'}) | ${response.actual_cost_usd:.6f} | {response.duration_ms}ms")
        
        return call_record
        
    except BudgetExceededError:
        # Re-raise to stop all workers
        raise
    except RuntimeError as e:
        error_msg = str(e)
        if "PERMANENT_ERROR:" in error_msg:
            # Permanent error - disable immediately (don't count to 3)
            circuit_breaker._disabled.add(model_id)
            print(f"  ⊗ {model_id} DISABLED immediately (permanent error)")
            print(f"  ✗ {error_msg}")
            return None
        elif "FATAL: Ledger write failed" in error_msg:
            # Re-raise fatal storage errors
            raise
        else:
            # Other runtime errors - count toward circuit breaker
            disabled = circuit_breaker.record_failure(model_id)
            if disabled:
                print(f"  ⊗ {model_id} DISABLED after {circuit_breaker.max_failures} failures")
            print(f"  ✗ ERROR: {e}")
            return None
    except Exception as e:
        # Transient errors - record failure in circuit breaker
        disabled = circuit_breaker.record_failure(model_id)
        if disabled:
            print(f"  ⊗ {model_id} DISABLED after {circuit_breaker.max_failures} failures")
        print(f"  ✗ ERROR: {e}")
        return None


def compute_method_hash(config_path: Path, scenarios_path: Path) -> str:
    """Compute hash of method files for versioning."""
    hasher = hashlib.sha256()
    
    with open(config_path, 'rb') as f:
        hasher.update(f.read())
    
    with open(scenarios_path, 'rb') as f:
        hasher.update(f.read())
    
    return f"sha256:{hasher.hexdigest()}"


def compute_summary(manifest: Dict):
    """Compute summary statistics."""
    by_model = {}
    by_scenario = {}
    
    for call in manifest["calls"]:
        model_id = call["model_id"]
        # Support both scenario_id (checkpoint) and question_id (recovery)
        scenario_id = call.get("scenario_id") or call.get("question_id")
        
        if model_id not in by_model:
            by_model[model_id] = {
                "total": 0,
                "valid": 0,
                "invalid": 0,
                "cost_usd": 0.0
            }
        
        if scenario_id not in by_scenario:
            by_scenario[scenario_id] = {
                "total": 0,
                "valid": 0,
                "invalid": 0,
                "cost_usd": 0.0
            }
        
        # Support both checkpoint format (response_parsed) and recovery format (display_letter)
        if "response_parsed" in call:
            valid = call["response_parsed"]["valid"]
        elif "display_letter" in call:
            valid = call["display_letter"] is not None
        else:
            valid = False
        
        cost = call.get("cost_usd", 0.0)
        
        by_model[model_id]["total"] += 1
        by_model[model_id]["cost_usd"] += cost
        if valid:
            by_model[model_id]["valid"] += 1
        else:
            by_model[model_id]["invalid"] += 1
        
        by_scenario[scenario_id]["total"] += 1
        by_scenario[scenario_id]["cost_usd"] += cost
        if valid:
            by_scenario[scenario_id]["valid"] += 1
        else:
            by_scenario[scenario_id]["invalid"] += 1
    
    manifest["summary"]["by_model"] = by_model
    manifest["summary"]["by_scenario"] = by_scenario


def main():
    parser = argparse.ArgumentParser(
        description="Run quiz comparison experiment"
    )
    parser.add_argument(
        "--config",
        type=Path,
        default=Path(__file__).parent / "config.json",
        help="Path to config.json"
    )
    parser.add_argument(
        "--scenarios",
        type=Path,
        default=Path(__file__).parent / "scenarios.json",
        help="Path to scenarios.json"
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path(__file__).parent.parent / "manifests",
        help="Output directory for manifests"
    )
    parser.add_argument(
        "--budget-cap",
        type=float,
        default=5.0,
        help="Budget cap in USD (default: 5.00)"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Mock API calls (no actual spend)"
    )
    parser.add_argument(
        "--resume",
        type=Path,
        help="Resume from checkpoint manifest"
    )
    parser.add_argument(
        "--run-id",
        type=str,
        help="Unique run ID (default: auto-generated timestamp)"
    )
    parser.add_argument(
        "--ledger-path",
        "--ledger",  # Alias for convenience
        type=Path,
        dest="ledger_path",
        help="Path to ledger.db (default: research/ledger.db)"
    )
    parser.add_argument(
        "--max-workers",
        type=int,
        default=4,
        help="Maximum concurrent workers (default: 4)"
    )
    parser.add_argument(
        "--http-timeout",
        type=int,
        default=180,
        help="HTTP timeout in seconds (default: 180)"
    )
    
    args = parser.parse_args()
    
    # Create output directory
    args.output_dir.mkdir(parents=True, exist_ok=True)
    
    # Run quiz
    run_quiz(
        config_path=args.config,
        scenarios_path=args.scenarios,
        output_dir=args.output_dir,
        budget_cap=args.budget_cap,
        dry_run=args.dry_run,
        resume_from=args.resume,
        run_id=args.run_id,
        ledger_path=args.ledger_path,
        max_workers=args.max_workers,
        http_timeout=args.http_timeout
    )


if __name__ == "__main__":
    main()
