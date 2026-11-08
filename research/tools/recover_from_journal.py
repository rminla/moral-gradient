#!/usr/bin/env python3
"""
Recovery tool to replay journal entries into ledger.

Use when:
- Ledger write failed but journal was preserved
- Checkpoint missing some calls
- Need to rebuild results from journals without new API calls

This tool reads journal files and replays them into the ledger atomically.
"""

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from lib.budget import BudgetTracker
from lib.journal import ResponseJournal


def recover_from_journals(
    journal_dir: Path,
    ledger_path: Path,
    call_ids: list = None,
    dry_run: bool = False
):
    """
    Replay journal entries into ledger.
    
    Args:
        journal_dir: Directory containing .journal files
        ledger_path: Path to ledger.db
        call_ids: Optional list of specific call IDs to recover (default: all)
        dry_run: If True, show what would be recovered without writing
    
    Returns:
        Dict with recovery statistics
    """
    journal = ResponseJournal(journal_dir)
    
    # Find all journal files
    journal_files = sorted(journal_dir.glob("*.journal"))
    
    if not journal_files:
        print(f"No journal files found in {journal_dir}")
        return {"recovered": 0, "skipped": 0, "errors": []}
    
    print(f"Found {len(journal_files)} journal files")
    
    # Filter by call_ids if specified
    if call_ids:
        journal_files = [
            f for f in journal_files
            if f.stem in call_ids
        ]
        print(f"Filtered to {len(journal_files)} matching call IDs")
    
    # Initialize budget tracker (db_path, global_cap_usd positional)
    budget_tracker = BudgetTracker(ledger_path, 1000000.0)
    
    stats = {
        "recovered": 0,
        "skipped": 0,
        "already_exists": 0,
        "errors": []
    }
    
    for journal_file in journal_files:
        call_id = journal_file.stem
        
        try:
            # Read journal entry
            with open(journal_file) as f:
                entry = json.load(f)
            
            # Check if already in ledger
            if budget_tracker.check_call_exists(call_id):
                print(f"  ⊙ {call_id}: Already in ledger, skipping")
                stats["already_exists"] += 1
                continue
            
            # Check if reservation exists
            with budget_tracker._get_conn() as conn:
                res = conn.execute(
                    "SELECT * FROM reservations WHERE call_id = ?",
                    (call_id,)
                ).fetchone()
            
            if not res:
                print(f"  ✗ {call_id}: No reservation found, cannot recover")
                stats["errors"].append(f"{call_id}: No reservation")
                continue
            
            if dry_run:
                print(f"  [DRY RUN] Would recover {call_id}:")
                print(f"    Model: {entry.get('model_id')}")
                print(f"    Cost: ${entry.get('actual_cost_usd', 0):.6f}")
                print(f"    Tokens: {entry.get('usage', {}).get('total_tokens', 0)}")
                stats["recovered"] += 1
                continue
            
            # Replay into ledger via reconcile
            usage = entry.get('usage', {})
            budget_tracker.reconcile(
                call_id=call_id,
                model_version=entry.get('model_version', 'unknown'),
                prompt_tokens=usage.get('prompt_tokens', 0),
                completion_tokens=usage.get('completion_tokens', 0),
                actual_cost_usd=entry.get('actual_cost_usd', 0.0),
                duration_ms=entry.get('duration_ms', 0),
                experiment=entry.get('experiment', 'unknown'),
                metadata=entry.get('metadata'),
                error=entry.get('error'),
                finish_reason=entry.get('finish_reason')
            )
            
            print(f"  ✓ {call_id}: Recovered (${entry.get('actual_cost_usd', 0):.6f})")
            stats["recovered"] += 1
            
        except Exception as e:
            print(f"  ✗ {call_id}: Recovery failed - {e}")
            stats["errors"].append(f"{call_id}: {str(e)}")
    
    print(f"\n{'='*60}")
    print(f"Recovery Summary")
    print(f"{'='*60}")
    print(f"Recovered: {stats['recovered']}")
    print(f"Already exists: {stats['already_exists']}")
    print(f"Errors: {len(stats['errors'])}")
    
    if stats['errors']:
        print(f"\nErrors:")
        for err in stats['errors']:
            print(f"  - {err}")
    
    return stats


def rebuild_manifest_from_ledger(
    ledger_path: Path,
    experiment: str,
    output_path: Path,
    run_id: str = None,
    journal_dir: Path = None
):
    """
    Rebuild results manifest from ledger + journals.
    
    For quiz: Parses journals to extract FULL answers (semantic choice, question, options)
    For swarm: Reconstructs tool calls and outcomes
    
    Use when checkpoint is incomplete but ledger has all calls.
    
    Args:
        ledger_path: Path to ledger.db
        experiment: Experiment name (quiz, swarm)
        output_path: Where to write rebuilt manifest
        run_id: Optional run_id to filter calls
        journal_dir: Path to journal directory (for quiz answer recovery)
    """
    budget_tracker = BudgetTracker(ledger_path, 1000000.0)
    
    # Get ledger entries
    with budget_tracker._get_conn() as conn:
        if run_id:
            query = """
                SELECT * FROM calls 
                WHERE experiment = ? AND call_id LIKE ?
                ORDER BY timestamp
            """
            rows = conn.execute(query, (experiment, f"{run_id}_%")).fetchall()
        else:
            query = """
                SELECT * FROM calls 
                WHERE experiment = ?
                ORDER BY timestamp
            """
            rows = conn.execute(query, (experiment,)).fetchall()
    
    print(f"Found {len(rows)} calls for experiment={experiment}")
    
    if not rows:
        print("No calls found")
        return None
    
    # Initialize journal reader
    if journal_dir is None:
        journal_dir = ledger_path.parent / "journal"
    
    journal = ResponseJournal(journal_dir) if journal_dir.exists() else None
    
    # Build manifest structure
    manifest = {
        "version": "rebuilt",
        "rebuilt_at": datetime.utcnow().isoformat() + "Z",
        "experiment": experiment,
        "total_calls": len(rows),
        "total_cost_usd": sum(r['actual_cost_usd'] for r in rows),
        "results": [] if experiment == "quiz" else None,
        "calls": []
    }
    
    print(f"Rebuilding {experiment} results from {len(rows)} ledger entries...")
    
    if experiment == "quiz" and journal:
        # Parse quiz answers from journals
        results = []
        for row in rows:
            call_id = row['call_id']
            journal_path = journal_dir / f"{call_id}.journal"
            
            if not journal_path.exists():
                print(f"  ⚠ {call_id}: No journal found")
                continue
            
            try:
                # Read journal entry
                with open(journal_path) as f:
                    entry = json.load(f)
                
                # Parse quiz answer from raw response
                raw_response = entry.get('raw_response')
                if not raw_response:
                    print(f"  ⚠ {call_id}: No raw_response in journal")
                    continue
                
                # Extract content
                content = ""
                if 'content' in raw_response:
                    if isinstance(raw_response['content'], list):
                        # Anthropic format
                        content = "\n".join(
                            block.get('text', '') 
                            for block in raw_response['content']
                            if block.get('type') == 'text'
                        )
                    else:
                        content = str(raw_response['content'])
                elif 'choices' in raw_response:
                    # OpenAI format
                    content = raw_response['choices'][0]['message']['content']
                
                # Parse call_id: run_id_question_model_sample
                parts = call_id.split('_')
                if len(parts) >= 4:
                    # Extract question, model, sample from call_id
                    # Format: {run_id}_q{N}_{model}_{sample}
                    question_part = [p for p in parts if p.startswith('q')]
                    model_parts = [p for p in parts if '/' in p or p in ['anthropic', 'groq', 'openrouter']]
                    sample_part = [p for p in parts if p.startswith('s')]
                    
                    question_id = question_part[0] if question_part else None
                    model_slug = '_'.join(model_parts) if model_parts else row['model_id']
                    sample_idx = int(sample_part[0][1:]) if sample_part else 0
                    
                    # Parse semantic choice (A/B/C/D) from content
                    import re
                    choice_match = re.search(r'\b([A-D])\b', content)
                    semantic_choice = choice_match.group(1) if choice_match else None
                    
                    result = {
                        "call_id": call_id,
                        "question_id": question_id,
                        "model_id": model_slug,
                        "sample_idx": sample_idx,
                        "semantic_choice": semantic_choice,
                        "response_text": content[:500],  # Preview
                        "finish_reason": entry.get('finish_reason'),
                        "usage": entry.get('usage', {}),
                        "cost_usd": entry.get('actual_cost_usd', 0.0),
                        "refusal": "refuse" in content.lower() or "cannot" in content.lower(),
                        "truncated": entry.get('finish_reason') == 'length'
                    }
                    
                    results.append(result)
                    
                    if len(results) % 50 == 0:
                        print(f"  Parsed {len(results)} quiz answers...")
                
            except Exception as e:
                print(f"  ✗ {call_id}: Failed to parse - {e}")
                continue
        
        manifest["results"] = results
        print(f"✓ Recovered {len(results)} quiz answers from journals")
    
    # Add ledger summary (costs, not full answers)
    for row in rows:
        manifest["calls"].append({
            "call_id": row['call_id'],
            "timestamp": row['timestamp'],
            "model_id": row['model_id'],
            "model_version": row['model_version'],
            "provider": row['provider'],
            "usage": {
                "prompt_tokens": row['prompt_tokens'],
                "completion_tokens": row['completion_tokens'],
                "total_tokens": row['total_tokens']
            },
            "actual_cost_usd": row['actual_cost_usd'],
            "duration_ms": row['duration_ms'],
            "finish_reason": row['finish_reason'],
            "error": row['error']
        })
    
    with open(output_path, 'w') as f:
        json.dump(manifest, f, indent=2)
    
    print(f"\n✓ Rebuilt manifest written to {output_path}")
    print(f"Total calls: {manifest['total_calls']}")
    if experiment == "quiz" and 'results' in manifest:
        print(f"Quiz answers recovered: {len(manifest.get('results', []))}")
    print(f"Total cost: ${manifest['total_cost_usd']:.4f}")
    
    return manifest


def main():
    parser = argparse.ArgumentParser(
        description="Recover ledger entries from journals"
    )
    
    subparsers = parser.add_subparsers(dest='command', help='Command')
    
    # Recover command
    recover_parser = subparsers.add_parser('recover', help='Replay journals into ledger')
    recover_parser.add_argument(
        '--journal-dir',
        type=Path,
        required=True,
        help='Directory containing .journal files'
    )
    recover_parser.add_argument(
        '--ledger',
        type=Path,
        required=True,
        help='Path to ledger.db'
    )
    recover_parser.add_argument(
        '--call-ids',
        nargs='+',
        help='Specific call IDs to recover (default: all)'
    )
    recover_parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Show what would be recovered without writing'
    )
    
    # Rebuild command
    rebuild_parser = subparsers.add_parser('rebuild', help='Rebuild manifest from ledger + journals')
    rebuild_parser.add_argument(
        '--ledger',
        type=Path,
        required=True,
        help='Path to ledger.db'
    )
    rebuild_parser.add_argument(
        '--experiment',
        required=True,
        help='Experiment name (quiz, swarm)'
    )
    rebuild_parser.add_argument(
        '--output',
        type=Path,
        required=True,
        help='Output path for rebuilt manifest'
    )
    rebuild_parser.add_argument(
        '--run-id',
        help='Optional run_id to filter calls'
    )
    rebuild_parser.add_argument(
        '--journal-dir',
        type=Path,
        help='Path to journal directory (default: ledger parent dir / journal)'
    )
    
    args = parser.parse_args()
    
    if args.command == 'recover':
        recover_from_journals(
            journal_dir=args.journal_dir,
            ledger_path=args.ledger,
            call_ids=args.call_ids,
            dry_run=args.dry_run
        )
    elif args.command == 'rebuild':
        rebuild_manifest_from_ledger(
            ledger_path=args.ledger,
            experiment=args.experiment,
            output_path=args.output,
            run_id=args.run_id,
            journal_dir=args.journal_dir
        )
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
