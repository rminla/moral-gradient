"""
Offline quiz response reparser - audits ALL 800 responses with v2 parser.

NO MODEL CALLS - reads existing journal files only.

Preserves original parser/classification/results immutable.
Reports every changed row with original/new reason/status/option_order.
Aggregates before/after ALL 800 statistics.
"""

import json
import sqlite3
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
import argparse
import sys

# Import both parsers
sys.path.insert(0, str(Path(__file__).parent.parent / "quiz"))
from parse_response_v2 import (
    parse_response_v2, 
    parse_response_v1_compat,
    map_choice_to_semantic
)


@dataclass
class ReparseResult:
    """Result of reparsing a single response."""
    call_id: str
    model_id: str
    scenario_id: str
    sample_idx: int
    
    # Original (v1)
    v1_letter: Optional[str]
    v1_semantic: Optional[str]
    v1_valid: bool
    
    # New (v2)
    v2_letter: Optional[str]
    v2_semantic: Optional[str]
    v2_valid: bool
    v2_reason: str
    
    # Change detection
    changed: bool
    change_type: str  # "letter_changed", "validity_changed", "both", "unchanged"
    
    # Context
    option_order: List[str]
    response_text_preview: str
    finish_reason: Optional[str]


def load_journal(journal_path: Path) -> Optional[Dict]:
    """Load journal file safely."""
    try:
        with open(journal_path) as f:
            return json.load(f)
    except Exception as e:
        print(f"⚠️  Failed to load {journal_path}: {e}")
        return None


def extract_response_text(journal: Dict) -> Optional[str]:
    """Extract response text from journal raw_response."""
    raw = journal.get('raw_response')
    if not raw:
        return None
    
    # Anthropic format: content array
    if isinstance(raw, dict) and 'content' in raw:
        content = raw['content']
        if isinstance(content, list):
            # Extract text blocks only
            text_parts = []
            for block in content:
                if isinstance(block, dict):
                    if block.get('type') == 'text' and 'text' in block:
                        text_parts.append(block['text'])
            return '\n'.join(text_parts) if text_parts else None
    
    # OpenAI format: choices[0].message.content
    if isinstance(raw, dict) and 'choices' in raw:
        choices = raw['choices']
        if isinstance(choices, list) and len(choices) > 0:
            message = choices[0].get('message', {})
            return message.get('content')
    
    return None


def parse_call_id(call_id: str, run_id: str, model_slugs: Dict[str, str]) -> Tuple[Optional[str], Optional[str], Optional[int]]:
    """Parse call_id into scenario_id, model_id, sample_idx."""
    if not call_id.startswith(run_id + '_'):
        return None, None, None
    
    remainder = call_id[len(run_id) + 1:]
    parts = remainder.rsplit('_', 1)
    if len(parts) != 2:
        return None, None, None
    
    try:
        sample_idx = int(parts[1])
    except ValueError:
        return None, None, None
    
    # Match model slug suffix
    for model_slug, model_id in model_slugs.items():
        if parts[0].endswith('_' + model_slug):
            scenario_id = parts[0][:-(len(model_slug) + 1)]
            return scenario_id, model_id, sample_idx
    
    return None, None, None


def reparse_responses(
    journal_dir: Path,
    ledger_path: Optional[Path],
    run_id: str,
    config: Dict,
    scenarios: Dict,
    output_path: Path,
    verbose: bool = False
) -> Dict:
    """
    Reparse all responses with v2 parser and audit changes.
    
    Args:
        journal_dir: Directory containing journal files
        ledger_path: Optional ledger for cross-reference
        run_id: Run ID to process
        config: Quiz config with models
        scenarios: Scenarios with option orders
        output_path: Where to write audit report
        verbose: Print detailed progress
    
    Returns:
        Audit report dict
    """
    # Build model slug lookup
    model_slugs = {}
    for model_id in config['models']:
        model_slug = model_id.replace('/', '_')
        model_slugs[model_slug] = model_id
    
    # Build scenario option order lookup
    scenario_orders = {}
    for scenario in scenarios['scenarios']:
        # Reconstruct deterministic order (same as quiz runner)
        # For now, use scenario options as-is (ordered)
        scenario_orders[scenario['id']] = [opt['id'] for opt in scenario['options']]
    
    # Find all journal files for this run
    if not journal_dir.exists():
        print(f"❌ Journal directory not found: {journal_dir}")
        return {"error": "journal_dir_not_found"}
    
    journal_files = sorted(journal_dir.glob(f"{run_id}_*.journal"))
    if not journal_files:
        print(f"⚠️  No journal files found for run_id: {run_id}")
        return {"error": "no_journals_found"}
    
    print(f"Found {len(journal_files)} journal files for {run_id}")
    
    # Process each journal
    results = []
    skipped = []
    
    for journal_path in journal_files:
        if verbose:
            print(f"  Processing: {journal_path.name}")
        
        journal = load_journal(journal_path)
        if not journal:
            skipped.append({"path": str(journal_path), "reason": "load_failed"})
            continue
        
        call_id = journal.get('call_id')
        if not call_id:
            skipped.append({"path": str(journal_path), "reason": "no_call_id"})
            continue
        
        # Parse call_id
        scenario_id, model_id, sample_idx = parse_call_id(call_id, run_id, model_slugs)
        if not model_id:
            skipped.append({"path": str(journal_path), "call_id": call_id, "reason": "parse_call_id_failed"})
            continue
        
        # Get option order for this scenario
        option_order = scenario_orders.get(scenario_id)
        if not option_order:
            skipped.append({"call_id": call_id, "reason": f"scenario_{scenario_id}_not_found"})
            continue
        
        # Extract response text
        response_text = extract_response_text(journal)
        if not response_text:
            # Check if it's an error call
            if journal.get('finish_reason') == 'error':
                skipped.append({"call_id": call_id, "reason": "error_call_no_response"})
                continue
            skipped.append({"call_id": call_id, "reason": "no_response_text"})
            continue
        
        # Parse with both parsers
        v1_letter = parse_response_v1_compat(response_text)
        v2_letter, v2_reason = parse_response_v2(response_text)
        
        # Map to semantic choices
        v1_semantic = map_choice_to_semantic(v1_letter, option_order)
        v2_semantic = map_choice_to_semantic(v2_letter, option_order)
        
        v1_valid = v1_letter is not None
        v2_valid = v2_letter is not None
        
        # Detect changes
        changed = (v1_letter != v2_letter) or (v1_valid != v2_valid)
        
        if v1_letter != v2_letter and v1_valid != v2_valid:
            change_type = "both"
        elif v1_letter != v2_letter:
            change_type = "letter_changed"
        elif v1_valid != v2_valid:
            change_type = "validity_changed"
        else:
            change_type = "unchanged"
        
        result = ReparseResult(
            call_id=call_id,
            model_id=model_id,
            scenario_id=scenario_id,
            sample_idx=sample_idx,
            v1_letter=v1_letter,
            v1_semantic=v1_semantic,
            v1_valid=v1_valid,
            v2_letter=v2_letter,
            v2_semantic=v2_semantic,
            v2_valid=v2_valid,
            v2_reason=v2_reason,
            changed=changed,
            change_type=change_type,
            option_order=option_order,
            response_text_preview=response_text[:200],
            finish_reason=journal.get('finish_reason')
        )
        
        results.append(result)
    
    # Aggregate statistics
    total = len(results)
    changed_count = sum(1 for r in results if r.changed)
    unchanged_count = total - changed_count
    
    v1_valid_count = sum(1 for r in results if r.v1_valid)
    v1_invalid_count = total - v1_valid_count
    
    v2_valid_count = sum(1 for r in results if r.v2_valid)
    v2_invalid_count = total - v2_valid_count
    
    # Changed breakdown
    letter_changed = sum(1 for r in results if r.change_type == "letter_changed")
    validity_changed = sum(1 for r in results if r.change_type == "validity_changed")
    both_changed = sum(1 for r in results if r.change_type == "both")
    
    # V2 reason breakdown
    v2_reasons = {}
    for r in results:
        v2_reasons[r.v2_reason] = v2_reasons.get(r.v2_reason, 0) + 1
    
    # By model breakdown
    by_model = {}
    for r in results:
        if r.model_id not in by_model:
            by_model[r.model_id] = {
                "total": 0,
                "v1_valid": 0,
                "v2_valid": 0,
                "changed": 0
            }
        by_model[r.model_id]["total"] += 1
        if r.v1_valid:
            by_model[r.model_id]["v1_valid"] += 1
        if r.v2_valid:
            by_model[r.model_id]["v2_valid"] += 1
        if r.changed:
            by_model[r.model_id]["changed"] += 1
    
    # Build audit report
    audit_report = {
        "run_id": run_id,
        "parser_version": "v2",
        "total_responses": total,
        "skipped": len(skipped),
        "summary": {
            "total_changed": changed_count,
            "total_unchanged": unchanged_count,
            "change_rate": f"{100*changed_count/total:.1f}%" if total > 0 else "0%"
        },
        "v1_stats": {
            "valid": v1_valid_count,
            "invalid": v1_invalid_count,
            "valid_rate": f"{100*v1_valid_count/total:.1f}%" if total > 0 else "0%"
        },
        "v2_stats": {
            "valid": v2_valid_count,
            "invalid": v2_invalid_count,
            "valid_rate": f"{100*v2_valid_count/total:.1f}%" if total > 0 else "0%"
        },
        "change_breakdown": {
            "letter_only": letter_changed,
            "validity_only": validity_changed,
            "both": both_changed
        },
        "v2_reason_distribution": v2_reasons,
        "by_model": by_model,
        "changed_rows": [
            {
                "call_id": r.call_id,
                "model_id": r.model_id,
                "scenario_id": r.scenario_id,
                "v1": {"letter": r.v1_letter, "semantic": r.v1_semantic, "valid": r.v1_valid},
                "v2": {"letter": r.v2_letter, "semantic": r.v2_semantic, "valid": r.v2_valid, "reason": r.v2_reason},
                "change_type": r.change_type,
                "response_preview": r.response_text_preview
            }
            for r in results if r.changed
        ],
        "skipped_rows": skipped
    }
    
    # Write audit report
    with open(output_path, 'w') as f:
        json.dump(audit_report, f, indent=2)
    
    print(f"\n{'='*60}")
    print(f"Reparse Audit Complete")
    print(f"{'='*60}")
    print(f"Total responses: {total}")
    print(f"Skipped: {len(skipped)}")
    print(f"\nV1 Parser: {v1_valid_count} valid ({100*v1_valid_count/total:.1f}%)")
    print(f"V2 Parser: {v2_valid_count} valid ({100*v2_valid_count/total:.1f}%)")
    print(f"\nChanged: {changed_count} ({100*changed_count/total:.1f}%)")
    print(f"  Letter only: {letter_changed}")
    print(f"  Validity only: {validity_changed}")
    print(f"  Both: {both_changed}")
    print(f"\nAudit report: {output_path}")
    print(f"{'='*60}\n")
    
    return audit_report


def main():
    parser = argparse.ArgumentParser(
        description="Reparse quiz responses with v2 parser (offline, no model calls)"
    )
    parser.add_argument("--journal-dir", type=Path, required=True,
                        help="Directory containing journal files")
    parser.add_argument("--run-id", type=str, required=True,
                        help="Run ID to process")
    parser.add_argument("--config", type=Path, required=True,
                        help="Quiz config.json")
    parser.add_argument("--scenarios", type=Path, required=True,
                        help="Scenarios.json")
    parser.add_argument("--output", type=Path, required=True,
                        help="Output audit report path")
    parser.add_argument("--ledger", type=Path,
                        help="Optional ledger for cross-reference")
    parser.add_argument("--verbose", action="store_true",
                        help="Print detailed progress")
    
    args = parser.parse_args()
    
    # Load config and scenarios
    with open(args.config) as f:
        config = json.load(f)
    
    with open(args.scenarios) as f:
        scenarios = json.load(f)
    
    # Run reparse
    audit_report = reparse_responses(
        journal_dir=args.journal_dir,
        ledger_path=args.ledger,
        run_id=args.run_id,
        config=config,
        scenarios=scenarios,
        output_path=args.output,
        verbose=args.verbose
    )
    
    # Exit with status
    if "error" in audit_report:
        sys.exit(1)
    
    sys.exit(0)


if __name__ == "__main__":
    main()
