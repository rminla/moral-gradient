#!/usr/bin/env python3
"""
Quiz comparison harness for Moral Gradient v4.

Runs 10-question quiz across 4 models with randomized option order.
"""

import argparse
import hashlib
import json
import random
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from lib.budget import BudgetTracker, BudgetExceededError
from lib.providers import Message, ProviderClient
from lib.models import MODELS, verify_model_availability


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
    ledger_path: Optional[Path] = None
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
    budget_tracker = BudgetTracker(ledger_path, budget_cap)
    
    # Initialize provider client
    provider_client = ProviderClient(
        budget_tracker=budget_tracker,
        experiment="quiz",
        dry_run=dry_run
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
            manifest["calls"] = prev_manifest["calls"]
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
    
    # Execute calls
    try:
        for i, call_spec in enumerate(call_plan, 1):
            print(f"[{i}/{len(call_plan)}] {call_spec['scenario_id']} / {call_spec['model_id']} / {call_spec['call_index']}")
            
            # Generate prompt
            prompt = generate_prompt(
                call_spec['scenario'],
                call_spec['option_order'],
                config['prompt_template']
            )
            
            prompt_hash = hashlib.sha256(prompt.encode()).hexdigest()
            
            messages = [Message(role="user", content=prompt)]
            
            # Make call
            try:
                response = provider_client.call_model(
                    call_id=call_spec['call_id'],
                    model_id=call_spec['model_id'],
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
                
                # Record call
                truncated = (response.finish_reason == "length") if response.finish_reason else False
                
                call_record = {
                    "call_id": call_spec['call_id'],
                    "timestamp": datetime.utcnow().isoformat() + "Z",
                    "model_id": call_spec['model_id'],
                    "model_version": response.model_version,
                    "scenario_id": call_spec['scenario_id'],
                    "option_order": call_spec['option_order'],
                    "prompt_hash": prompt_hash,
                    "response_raw": response.content[:500],  # Truncate for storage
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
                
                manifest["calls"].append(call_record)
                
                # Update summary
                manifest["summary"]["total_calls"] += 1
                if valid:
                    manifest["summary"]["valid_responses"] += 1
                else:
                    manifest["summary"]["invalid_responses"] += 1
                manifest["summary"]["total_cost_usd"] += response.actual_cost_usd
                
                print(f"  → {letter_choice or 'INVALID'} ({semantic_choice or 'N/A'}) | ${response.actual_cost_usd:.6f} | {response.duration_ms}ms")
                
                # Checkpoint every 10 calls
                if i % 10 == 0:
                    checkpoint_path = output_dir / f"{run_id}_checkpoint.json"
                    with open(checkpoint_path, 'w') as f:
                        json.dump(manifest, f, indent=2)
                    print(f"  💾 Checkpoint saved: {checkpoint_path}")
                
            except BudgetExceededError as e:
                print(f"\n⚠️  BUDGET EXCEEDED: {e}")
                print(f"Stopping at call {i}/{len(call_plan)}")
                break
            except Exception as e:
                print(f"  ✗ ERROR: {e}")
                # Continue to next call
                continue
    
    except KeyboardInterrupt:
        print("\n\n⚠️  Interrupted by user")
    
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
    
    return manifest


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
        scenario_id = call["scenario_id"]
        
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
        
        valid = call["response_parsed"]["valid"]
        cost = call["cost_usd"]
        
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
        resume_from=args.resume
    )


if __name__ == "__main__":
    main()
