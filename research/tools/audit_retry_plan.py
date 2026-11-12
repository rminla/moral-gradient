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
    # Build model slug lookup (model_id with / -> _)
    model_slugs = {}
    for model_id in config['models']:
        model_slug = model_id.replace('/', '_')
        model_slugs[model_slug] = model_id
    
    def parse_call_id(call_id, run_id_prefix, model_slugs):
        """Parse call_id into (scenario_id, model_id, sample_idx).
        
        Format: {run_id}_{scenario_id}_{model_slug}_{sample_idx}
        
        Strategy (same as proven recovery logic):
        1. Remove known run_id prefix
        2. Extract integer suffix (sample_idx)
        3. Match known model_slug suffix
        4. What remains is scenario_id
        """
        if not call_id.startswith(run_id_prefix + '_'):
            return None, None, None
        
        # Remove run_id prefix
        remainder = call_id[len(run_id_prefix) + 1:]
        
        # Extract integer suffix (sample_idx)
        parts = remainder.rsplit('_', 1)
        if len(parts) != 2:
            return None, None, None
        try:
            sample_idx = int(parts[1])
        except ValueError:
            return None, None, None
        
        # Now parts[0] is "{scenario_id}_{model_slug}"
        # Try each known model_slug as suffix
        for model_slug, model_id in model_slugs.items():
            if parts[0].endswith('_' + model_slug):
                # Found model_slug suffix
                scenario_id = parts[0][:-(len(model_slug) + 1)]
                return scenario_id, model_id, sample_idx
        
        return None, None, None
    
    with budget._get_conn() as conn:
        rows = conn.execute("""
            SELECT call_id, model_id, finish_reason, actual_cost_usd, error
            FROM calls
            WHERE call_id LIKE ? || '_%'
        """, (run_id,)).fetchall()
        
        # ALSO get held reservations (reserved but no calls row)
        held_rows = conn.execute("""
            SELECT r.call_id, r.reserved_usd
            FROM reservations r
            WHERE r.call_id LIKE ? || '_%'
            AND r.reconciled = 0
            AND NOT EXISTS (SELECT 1 FROM calls c WHERE c.call_id = r.call_id)
        """, (run_id,)).fetchall()
    
    # Categorize recorded attempts
    errors = []  # Definite local errors (SDK config, not network)
    held = []    # Unknown cost (billed but no journal)
    completed = set()  # Successful answers (including valid refusals/invalids)
    
    for row in rows:
        call_id = row['call_id']
        
        scenario_id, model_id, sample_idx = parse_call_id(call_id, run_id, model_slugs)
        if not model_id:
            continue
        
        model_slug = model_id.replace('/', '_')
        logical_id = f"{scenario_id}_{model_slug}_{sample_idx}"
        
        # Categorize by finish_reason
        if row['finish_reason'] == 'error':
            # Check if definite local error (SDK config, not network)
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
        else:
            # Completed: any non-error finish_reason (stop/end_turn) OR NULL with cost > 0
            # This includes valid answers, refusals, and invalid responses
            completed.add((scenario_id, model_id, sample_idx))
    
    # Process held reservations (billed but no journal/calls row)
    for row in held_rows:
        call_id = row['call_id']
        
        scenario_id, model_id, sample_idx = parse_call_id(call_id, run_id, model_slugs)
        if not model_id:
            continue
        
        model_slug = model_id.replace('/', '_')
        logical_id = f"{scenario_id}_{model_slug}_{sample_idx}"
        
        held.append({
            'logical_id': logical_id,
            'scenario_id': scenario_id,
            'model_id': model_id,
            'sample_idx': sample_idx,
            'old_call_id': call_id,
            'held_cost': row['reserved_usd']
        })
    
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
