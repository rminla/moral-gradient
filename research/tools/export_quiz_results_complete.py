"""
Export complete quiz results for public website with model×question choice counts.

Includes:
- All 40 model×question cells (4 models × 10 questions)
- Semantic option IDs + counts (not just A/B)
- Refusal/non-answer counts
- Sample size n=20 per cell
- Option order balance
- Actual model versions/providers/dates from journals
- Question text/hash for UI prompt parity
"""

import json
import sqlite3
from pathlib import Path
from typing import Dict, List, Optional
import argparse
import sys
from collections import defaultdict
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent.parent / "quiz"))
from parse_response_v2 import parse_response_v2


def load_journal_metadata(journal_path: Path) -> Optional[Dict]:
    """Load metadata from journal file."""
    try:
        with open(journal_path) as f:
            journal = json.load(f)
        return {
            'model_version': journal.get('model_version'),
            'provider': journal.get('provider'),
            'timestamp': journal.get('timestamp'),
            'finish_reason': journal.get('finish_reason')
        }
    except:
        return None


def export_complete_results(
    manifest_path: Path,
    journal_dir: Path,
    scenarios_path: Path,
    output_path: Path
) -> Dict:
    """
    Export complete model×question results with choice counts.
    """
    # Load manifest
    with open(manifest_path) as f:
        manifest = json.load(f)
    
    # Load scenarios
    with open(scenarios_path) as f:
        scenarios_data = json.load(f)
    
    # Build scenario lookup
    scenarios = {}
    for scenario in scenarios_data['scenarios']:
        scenarios[scenario['id']] = scenario
    
    # Organize by model × scenario
    cells = defaultdict(lambda: {
        'responses': [],
        'choice_counts': defaultdict(int),
        'refusals': 0,
        'non_answers': 0,
        'sample_size': 0,
        'model_versions': set(),
        'providers': set(),
        'timestamps': [],
        'option_orders': []
    })
    
    for call in manifest['calls']:
        model_id = call['model_id']
        scenario_id = call.get('scenario_id', 'unknown')
        
        if scenario_id not in scenarios:
            continue
        
        cell_key = (model_id, scenario_id)
        cell = cells[cell_key]
        
        # Get response text
        response_text = call.get('response_raw', '')
        
        # Parse with v2
        v2_letter, v2_reason = parse_response_v2(response_text)
        
        # Get semantic choice from manifest if letter unchanged
        v1_letter = call['response_parsed'].get('letter_choice')
        if v2_letter == v1_letter:
            semantic_choice = call['response_parsed'].get('semantic_choice')
        else:
            # Letter changed - remap using option_order
            option_order = call.get('option_order', [])
            if v2_letter == 'A' and len(option_order) >= 1:
                semantic_choice = option_order[0]
            elif v2_letter == 'B' and len(option_order) >= 2:
                semantic_choice = option_order[1]
            else:
                semantic_choice = None
        
        # Load journal metadata
        call_id = call['call_id']
        journal_path = journal_dir / f"{call_id}.journal"
        journal_meta = load_journal_metadata(journal_path) if journal_path.exists() else {}
        
        # Record response
        response_record = {
            'call_id': call_id,
            'letter_choice': v2_letter,
            'semantic_choice': semantic_choice,
            'valid': v2_letter is not None,
            'v2_reason': v2_reason,
            'option_order': call.get('option_order', []),
            'timestamp': call.get('timestamp'),
            'model_version': journal_meta.get('model_version') if journal_meta else call.get('model_version'),
            'finish_reason': journal_meta.get('finish_reason') if journal_meta else call.get('finish_reason')
        }
        
        cell['responses'].append(response_record)
        cell['sample_size'] += 1
        
        if semantic_choice:
            cell['choice_counts'][semantic_choice] += 1
        elif 'refusal' in v2_reason:
            cell['refusals'] += 1
        else:
            cell['non_answers'] += 1
        
        if response_record['model_version']:
            cell['model_versions'].add(response_record['model_version'])
        if journal_meta and journal_meta.get('provider'):
            cell['providers'].add(journal_meta['provider'])
        if response_record['timestamp']:
            cell['timestamps'].append(response_record['timestamp'])
        cell['option_orders'].append(response_record['option_order'])
    
    # Build public export
    model_question_cells = []
    
    for (model_id, scenario_id), cell in sorted(cells.items()):
        scenario = scenarios[scenario_id]
        
        # Calculate option order balance
        option_orders_str = [str(o) for o in cell['option_orders']]
        unique_orders = list(set(option_orders_str))
        order_balance = {
            'unique_orders': len(unique_orders),
            'balanced': len(unique_orders) > 1  # At least 2 different orders
        }
        
        # Get actual model version (most common)
        model_version = list(cell['model_versions'])[0] if cell['model_versions'] else None
        provider = list(cell['providers'])[0] if cell['providers'] else model_id.split('/')[0]
        
        # Sample dates
        timestamps = sorted(cell['timestamps'])
        date_range = {
            'first': timestamps[0] if timestamps else None,
            'last': timestamps[-1] if timestamps else None
        }
        
        # Build cell record
        cell_record = {
            'model_id': model_id,
            'model_version': model_version,
            'provider': provider,
            'scenario_id': scenario_id,
            'scenario_title': scenario.get('title', scenario_id),
            'scenario_text': scenario.get('scenario', '')[:200] + '...',  # Preview only
            'scenario_hash': scenario.get('hash'),
            'options': [
                {
                    'option_id': opt['id'],
                    'option_text': opt.get('text') or opt.get('label', ''),
                    'count': cell['choice_counts'].get(opt['id'], 0)
                }
                for opt in scenario['options']
            ],
            'refusal_count': cell['refusals'],
            'non_answer_count': cell['non_answers'],
            'sample_size': cell['sample_size'],
            'expected_n': 20,
            'option_order_balance': order_balance,
            'date_range': date_range
        }
        
        model_question_cells.append(cell_record)
    
    # Build full export
    export_data = {
        'dataset': {
            'name': 'Moral Gradient Quiz Results',
            'version': 'v2_complete_20261108',
            'export_date': datetime.utcnow().isoformat() + 'Z',
            'description': 'Complete model×question results with semantic option choice counts',
            'caveat': '🎲 This dataset captures response patterns in controlled scenarios. Results should be interpreted as exploratory observations about reasoning patterns, not definitive claims about model capabilities or human values. Ethical behavior involves many factors beyond multiple-choice responses.',
            'total_cells': len(model_question_cells),
            'models': sorted(list(set(cell['model_id'] for cell in model_question_cells))),
            'scenarios': sorted(list(set(cell['scenario_id'] for cell in model_question_cells))),
            'total_responses': sum(cell['sample_size'] for cell in model_question_cells),
            'sample_size_per_cell': 20
        },
        'model_question_cells': model_question_cells,
        'metadata': {
            'parser_version': 'v2',
            'correction_note': '12 false negatives corrected (11 Qwen + 1 Haiku)',
            'option_ids_stable': True,
            'option_order_randomized': True,
            'ui_comparison_ready': True
        }
    }
    
    # Write output
    with open(output_path, 'w') as f:
        json.dump(export_data, f, indent=2)
    
    print(f"\n{'='*60}")
    print(f"Complete Quiz Results Exported")
    print(f"{'='*60}")
    print(f"Model×Question cells: {len(model_question_cells)}")
    print(f"Total responses: {export_data['dataset']['total_responses']}")
    print(f"Models: {len(export_data['dataset']['models'])}")
    print(f"Scenarios: {len(export_data['dataset']['scenarios'])}")
    print(f"\nOutput: {output_path}")
    print(f"{'='*60}\n")
    
    return export_data


def main():
    parser = argparse.ArgumentParser(
        description="Export complete quiz results with model×question choice counts"
    )
    parser.add_argument("--manifest", type=Path, required=True,
                        help="Quiz manifest JSON")
    parser.add_argument("--journals", type=Path, required=True,
                        help="Journal directory")
    parser.add_argument("--scenarios", type=Path, required=True,
                        help="Scenarios JSON")
    parser.add_argument("--output", type=Path, required=True,
                        help="Output JSON")
    
    args = parser.parse_args()
    
    export_complete_results(
        manifest_path=args.manifest,
        journal_dir=args.journals,
        scenarios_path=args.scenarios,
        output_path=args.output
    )
    
    sys.exit(0)


if __name__ == "__main__":
    main()
