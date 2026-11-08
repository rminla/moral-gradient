#!/usr/bin/env python3
"""
Audit retry plan for missing logical samples.

Identifies samples needing retry (errors + held) and generates
new attempt IDs linked to logical samples.
"""

import argparse
import json
import sqlite3
import sys
from pathlib import Path
from typing import Dict, List, Set

sys.path.insert(0, str(Path(__file__).parent.parent))

from lib.budget import BudgetTracker


def identify_missing_samples(
    ledger_path: Path,
    run_id: str,
    config: Dict,
    scenarios: List[Dict]
) -> Dict:
    """
    Identify logical samples needing retry.
    
    Returns:
        Dict with 'errors', 'held', and 'unattempted' lists
    """
    budget = BudgetTracker(ledger_path, 1000.0)  # Just for query
    
    # Expected logical samples
    expected = set()
    for scenario in scenarios:
        scenario_id = scenario['id']
        for model_id in config['models']:
            for sample_idx in range(config['n_per_question']):
                logical_id = f"{scenario_id}_{model_id.replace('/', '_')}_{sample_idx}"
                expected.add((scenario_id, model_id, sample_idx, logical_id))
    
    # Query ledger for recorded attempts
    with budget._get_conn() as conn:
        rows = conn.execute("""
            SELECT call_id, model_id, finish_reason, actual_cost_usd, error
            FROM calls
            WHERE call_id LIKE ? || '_%'
        """, (run_id,)).fetchall()
    
    # Categorize recorded attempts
    errors = []  # Definite local errors (SDK config, not network)
    held = []    # Unknown cost (billed but no journal)
    completed = set()  # Successful answers (including valid refusals)
    
    for row in rows:
        call_id = row['call_id']
        
        # Parse logical sample from call_id
        # Format: {run_id}_{scenario_id}_{model_slug}_{sample_idx}
        parts = call_id.split('_')
        if len(parts) < 4:
            continue
        
        # Find scenario_id (may have underscores)
        # Model slug is after scenario, sample_idx is last
        sample_idx = int(parts[-1])
        model_slug = '_'.join(parts[-2:-1]) if len(parts) > 4 else parts[-2]
        
        # Reconstruct scenario_id (everything between run_id and model_slug)
        run_id_parts = run_id.split('_')
        scenario_start = len(run_id_parts)
        model_start = len(parts) - 2
        scenario_id = '_'.join(parts[scenario_start:model_start])
        
        # Find model_id (reverse slug transformation)
        model_id = None
        for m in config['models']:
            if m.replace('/', '_') == model_slug:
                model_id = m
                break
        
        if not model_id:
            continue
        
        logical_id = f"{scenario_id}_{model_slug}_{sample_idx}"
        
        # Categorize
        if row['finish_reason'] == 'error':
            # Check if definite local error (not network)
            error_msg = row['error'] or ''
            if 'httpx' in error_msg.lower() or 'timeout argument' in error_msg.lower():
                errors.append({
                    'logical_id': logical_id,
                    'scenario_id': scenario_id,
                    'model_id': model_id,
                    'sample_idx': sample_idx,
                    'old_call_id': call_id,
                    'error': error_msg
                })
            # Network errors: don't retry (already counted as attempt)
        elif row['finish_reason'] is None and row['actual_cost_usd'] == 0:
            # Held/unknown (no finish_reason, no cost)
            held.append({
                'logical_id': logical_id,
                'scenario_id': scenario_id,
                'model_id': model_id,
                'sample_idx': sample_idx,
                'old_call_id': call_id,
                'held_cost': 'unknown'
            })
        else:
            # Completed (any finish_reason with cost, or refusal/stop)
            completed.add((scenario_id, model_id, sample_idx))
    
    # Find unattempted
    unattempted = []
    for scenario_id, model_id, sample_idx, logical_id in expected:
        if (scenario_id, model_id, sample_idx) not in completed:
            # Check if in errors or held
            in_errors = any(e['logical_id'] == logical_id for e in errors)
            in_held = any(h['logical_id'] == logical_id for h in held)
            if not in_errors and not in_held:
                unattempted.append({
                    'logical_id': logical_id,
                    'scenario_id': scenario_id,
                    'model_id': model_id,
                    'sample_idx': sample_idx
                })
    
    return {
        'errors': errors,
        'held': held,
        'unattempted': unattempted,
        'completed': len(completed),
        'total_expected': len(expected)
    }


def generate_retry_plan(
    missing: Dict,
    run_id: str,
    max_attempts: int = 2
) -> List[Dict]:
    """
    Generate retry plan with new attempt IDs.
    
    Args:
        missing: Output from identify_missing_samples
        run_id: Base run ID
        max_attempts: Maximum attempts per logical sample (including original)
    
    Returns:
        List of retry specs with new attempt IDs
    """
    retry_plan = []
    attempt_num = 2  # Original was attempt 1
    
    # Retry errors (definite local, not network)
    for item in missing['errors']:
        if attempt_num <= max_attempts:
            new_call_id = f"{run_id}_{item['scenario_id']}_{item['model_id'].replace('/', '_')}_{item['sample_idx']}_retry{attempt_num}"
            retry_plan.append({
                'new_call_id': new_call_id,
                'logical_id': item['logical_id'],
                'scenario_id': item['scenario_id'],
                'model_id': item['model_id'],
                'sample_idx': item['sample_idx'],
                'attempt_num': attempt_num,
                'reason': 'local_error',
                'old_call_id': item['old_call_id'],
                'old_error': item['error']
            })
    
    # Retry held (unknown cost, may be billed)
    for item in missing['held']:
        if attempt_num <= max_attempts:
            new_call_id = f"{run_id}_{item['scenario_id']}_{item['model_id'].replace('/', '_')}_{item['sample_idx']}_retry{attempt_num}"
            retry_plan.append({
                'new_call_id': new_call_id,
                'logical_id': item['logical_id'],
                'scenario_id': item['scenario_id'],
                'model_id': item['model_id'],
                'sample_idx': item['sample_idx'],
                'attempt_num': attempt_num,
                'reason': 'held_unknown_cost',
                'old_call_id': item['old_call_id'],
                'held_cost': 'preserved'
            })
    
    # Unattempted (never tried)
    for item in missing['unattempted']:
        # These use original call_id format (not retry)
        new_call_id = f"{run_id}_{item['scenario_id']}_{item['model_id'].replace('/', '_')}_{item['sample_idx']}"
        retry_plan.append({
            'new_call_id': new_call_id,
            'logical_id': item['logical_id'],
            'scenario_id': item['scenario_id'],
            'model_id': item['model_id'],
            'sample_idx': item['sample_idx'],
            'attempt_num': 1,
            'reason': 'unattempted',
            'old_call_id': None
        })
    
    return retry_plan


def main():
    parser = argparse.ArgumentParser(
        description="Audit retry plan for missing quiz samples"
    )
    parser.add_argument(
        "--ledger",
        type=Path,
        required=True,
        help="Path to ledger.db"
    )
    parser.add_argument(
        "--run-id",
        required=True,
        help="Run ID to audit"
    )
    parser.add_argument(
        "--config",
        type=Path,
        required=True,
        help="Path to config.json"
    )
    parser.add_argument(
        "--scenarios",
        type=Path,
        required=True,
        help="Path to scenarios.json"
    )
    parser.add_argument(
        "--output",
        type=Path,
        required=True,
        help="Output retry plan JSON"
    )
    parser.add_argument(
        "--max-attempts",
        type=int,
        default=2,
        help="Max attempts per logical sample (default: 2)"
    )
    
    args = parser.parse_args()
    
    # Load config
    with open(args.config) as f:
        config = json.load(f)
    
    with open(args.scenarios) as f:
        scenarios_data = json.load(f)
    
    # Identify missing
    print(f"Auditing run: {args.run_id}")
    print(f"Ledger: {args.ledger}")
    
    missing = identify_missing_samples(
        args.ledger,
        args.run_id,
        config,
        scenarios_data['scenarios']
    )
    
    print(f"\nCompleted: {missing['completed']}/{missing['total_expected']}")
    print(f"Errors (local SDK): {len(missing['errors'])}")
    print(f"Held (unknown cost): {len(missing['held'])}")
    print(f"Unattempted: {len(missing['unattempted'])}")
    
    # Generate retry plan
    retry_plan = generate_retry_plan(missing, args.run_id, args.max_attempts)
    
    print(f"\nRetry plan: {len(retry_plan)} calls")
    print(f"  Errors to retry: {sum(1 for r in retry_plan if r['reason'] == 'local_error')}")
    print(f"  Held to retry: {sum(1 for r in retry_plan if r['reason'] == 'held_unknown_cost')}")
    print(f"  Unattempted: {sum(1 for r in retry_plan if r['reason'] == 'unattempted')}")
    
    # Save plan
    plan_output = {
        'run_id': args.run_id,
        'audit_timestamp': '2026-11-08T22:19:00Z',
        'missing_summary': missing,
        'retry_plan': retry_plan
    }
    
    with open(args.output, 'w') as f:
        json.dump(plan_output, f, indent=2)
    
    print(f"\nRetry plan saved: {args.output}")
    print(f"Use: python3 research/quiz/run_quiz.py --retry-plan {args.output}")


if __name__ == "__main__":
    main()
