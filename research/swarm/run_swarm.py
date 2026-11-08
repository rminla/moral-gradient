#!/usr/bin/env python3
"""
Swarm experiment harness for Moral Gradient v4.

Runs multi-agent team vs single-agent comparisons under pressure conditions.
"""

import argparse
import hashlib
import json
import random
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from lib.budget import BudgetTracker, BudgetExceededError
from lib.providers import Message, ProviderClient
from lib.models import MODELS, verify_model_availability


def load_config(config_path: Path) -> Dict:
    """Load swarm configuration."""
    with open(config_path) as f:
        return json.load(f)


def load_cases(cases_path: Path) -> Dict:
    """Load case scenarios."""
    with open(cases_path) as f:
        return json.load(f)


def load_prompts(prompts_path: Path) -> Dict:
    """Load prompt templates."""
    with open(prompts_path) as f:
        return json.load(f)


def format_actions_list(actions: List[Dict]) -> str:
    """Format actions list for prompt."""
    return "\n".join(
        f"- {action['id']}: {action['label']}" 
        for action in actions
    )


def extract_action(response_text: str, pattern: str) -> Optional[str]:
    """
    Extract action code from response using regex pattern.
    
    Args:
        response_text: Model response
        pattern: Regex pattern for extraction
    
    Returns:
        Action code or None if parsing failed
    """
    match = re.search(pattern, response_text, re.IGNORECASE)
    if match:
        return match.group(1).upper()
    return None


def run_single_episode(
    episode_id: str,
    case: Dict,
    model_id: str,
    pressure: bool,
    config: Dict,
    prompts: Dict,
    provider_client: ProviderClient,
    run_id: str
) -> Dict:
    """
    Run a single-agent episode.
    
    Returns:
        Episode record dict
    """
    max_turns = config["max_turns"]["single"]
    turns = []
    final_action = None
    
    # Get prompts
    role_prompts = prompts["roles"]["single"]
    pressure_text = prompts["pressure_manipulation"]["with_pressure"] if pressure else ""
    
    # Build scenario prompt
    scenario_prompt = role_prompts["scenario_template"].format(
        scenario_text=case["scenario_text"],
        context=case["context"],
        actions_list=format_actions_list(case["actions"]),
        pressure=pressure_text
    )
    
    # Turn 1: Present scenario
    turn_1_messages = [
        Message(role="system", content=role_prompts["system"]),
        Message(role="user", content=scenario_prompt)
    ]
    
    call_id = f"{run_id}_{episode_id}_turn_1"
    
    try:
        response = provider_client.call_model(
            call_id=call_id,
            model_id=model_id,
            messages=turn_1_messages,
            max_tokens=config["sampling"]["max_tokens"],
            temperature=config["sampling"]["temperature"],
            metadata={"episode_id": episode_id, "turn": 1, "role": "single"}
        )
        
        turns.append({
            "turn_id": 1,
            "role": "single",
            "prompt_type": "scenario",
            "response": response.content[:500],
            "usage": response.usage,
            "cost_usd": response.actual_cost_usd,
            "duration_ms": response.duration_ms
        })
        
        # Extract action from first response
        action = extract_action(response.content, prompts["action_format"]["extraction_pattern"])
        
        if action:
            final_action = action
        
    except Exception as e:
        print(f"  ✗ Turn 1 failed: {e}")
        turns.append({
            "turn_id": 1,
            "role": "single",
            "error": str(e)
        })
    
    # Turn 2: Decision confirmation (if no action yet)
    if not final_action and len(turns) < max_turns:
        call_id = f"{run_id}_{episode_id}_turn_2"
        
        try:
            turn_2_messages = turn_1_messages + [
                Message(role="assistant", content=response.content),
                Message(role="user", content=role_prompts["decision_template"])
            ]
            
            response = provider_client.call_model(
                call_id=call_id,
                model_id=model_id,
                messages=turn_2_messages,
                max_tokens=config["sampling"]["max_tokens"],
                temperature=config["sampling"]["temperature"],
                metadata={"episode_id": episode_id, "turn": 2, "role": "single"}
            )
            
            turns.append({
                "turn_id": 2,
                "role": "single",
                "prompt_type": "decision",
                "response": response.content[:500],
                "usage": response.usage,
                "cost_usd": response.actual_cost_usd,
                "duration_ms": response.duration_ms
            })
            
            action = extract_action(response.content, prompts["action_format"]["extraction_pattern"])
            if action:
                final_action = action
        
        except Exception as e:
            print(f"  ✗ Turn 2 failed: {e}")
            turns.append({
                "turn_id": 2,
                "role": "single",
                "error": str(e)
            })
    
    # Build episode record
    total_cost = sum(t.get("cost_usd", 0) for t in turns)
    complete = final_action is not None
    
    return {
        "episode_id": episode_id,
        "case_id": case["id"],
        "model_id": model_id,
        "arm": "single_pressure" if pressure else "single_no_pressure",
        "structure": "single",
        "pressure": pressure,
        "turns": turns,
        "final_action": final_action,
        "complete": complete,
        "total_cost_usd": total_cost
    }


def run_team_episode(
    episode_id: str,
    case: Dict,
    model_id: str,
    pressure: bool,
    config: Dict,
    prompts: Dict,
    provider_client: ProviderClient,
    run_id: str
) -> Dict:
    """
    Run a team episode (worker → manager → reviewer).
    
    Returns:
        Episode record dict
    """
    max_turns = config["max_turns"]["team"]
    turns = []
    final_action = None
    
    pressure_text = prompts["pressure_manipulation"]["with_pressure"] if pressure else ""
    
    # Turn 1: Worker receives scenario
    worker_prompts = prompts["roles"]["worker"]
    scenario_prompt = worker_prompts["scenario_template"].format(
        scenario_text=case["scenario_text"],
        context=case["context"],
        actions_list=format_actions_list(case["actions"])
    )
    
    call_id = f"{run_id}_{episode_id}_turn_1_worker"
    worker_proposal = None
    
    try:
        response = provider_client.call_model(
            call_id=call_id,
            model_id=model_id,
            messages=[
                Message(role="system", content=worker_prompts["system"]),
                Message(role="user", content=scenario_prompt)
            ],
            max_tokens=config["sampling"]["max_tokens"],
            temperature=config["sampling"]["temperature"],
            metadata={"episode_id": episode_id, "turn": 1, "role": "worker"}
        )
        
        worker_proposal = response.content
        
        turns.append({
            "turn_id": 1,
            "role": "worker",
            "prompt_type": "scenario",
            "response": response.content[:500],
            "usage": response.usage,
            "cost_usd": response.actual_cost_usd,
            "duration_ms": response.duration_ms
        })
    
    except Exception as e:
        print(f"  ✗ Worker turn failed: {e}")
        turns.append({"turn_id": 1, "role": "worker", "error": str(e)})
        return {
            "episode_id": episode_id,
            "case_id": case["id"],
            "model_id": model_id,
            "arm": "team_pressure" if pressure else "team_no_pressure",
            "structure": "team",
            "pressure": pressure,
            "turns": turns,
            "final_action": None,
            "complete": False,
            "total_cost_usd": sum(t.get("cost_usd", 0) for t in turns)
        }
    
    # Turn 2: Manager reviews
    manager_prompts = prompts["roles"]["manager"]
    manager_prompt = manager_prompts["review_template"].format(
        worker_proposal=worker_proposal,
        pressure=pressure_text
    )
    
    call_id = f"{run_id}_{episode_id}_turn_2_manager"
    manager_decision = None
    
    try:
        response = provider_client.call_model(
            call_id=call_id,
            model_id=model_id,
            messages=[
                Message(role="system", content=manager_prompts["system"]),
                Message(role="user", content=manager_prompt)
            ],
            max_tokens=config["sampling"]["max_tokens"],
            temperature=config["sampling"]["temperature"],
            metadata={"episode_id": episode_id, "turn": 2, "role": "manager"}
        )
        
        manager_decision = response.content
        
        turns.append({
            "turn_id": 2,
            "role": "manager",
            "prompt_type": "review",
            "response": response.content[:500],
            "usage": response.usage,
            "cost_usd": response.actual_cost_usd,
            "duration_ms": response.duration_ms
        })
    
    except Exception as e:
        print(f"  ✗ Manager turn failed: {e}")
        turns.append({"turn_id": 2, "role": "manager", "error": str(e)})
        return {
            "episode_id": episode_id,
            "case_id": case["id"],
            "model_id": model_id,
            "arm": "team_pressure" if pressure else "team_no_pressure",
            "structure": "team",
            "pressure": pressure,
            "turns": turns,
            "final_action": None,
            "complete": False,
            "total_cost_usd": sum(t.get("cost_usd", 0) for t in turns)
        }
    
    # Turn 3: Reviewer makes final decision
    reviewer_prompts = prompts["roles"]["reviewer"]
    reviewer_prompt = reviewer_prompts["review_template"].format(
        worker_proposal=worker_proposal,
        manager_decision=manager_decision
    )
    
    call_id = f"{run_id}_{episode_id}_turn_3_reviewer"
    
    try:
        response = provider_client.call_model(
            call_id=call_id,
            model_id=model_id,
            messages=[
                Message(role="system", content=reviewer_prompts["system"]),
                Message(role="user", content=reviewer_prompt)
            ],
            max_tokens=config["sampling"]["max_tokens"],
            temperature=config["sampling"]["temperature"],
            metadata={"episode_id": episode_id, "turn": 3, "role": "reviewer"}
        )
        
        turns.append({
            "turn_id": 3,
            "role": "reviewer",
            "prompt_type": "final",
            "response": response.content[:500],
            "usage": response.usage,
            "cost_usd": response.actual_cost_usd,
            "duration_ms": response.duration_ms
        })
        
        # Extract final action
        action = extract_action(response.content, prompts["action_format"]["extraction_pattern"])
        if action:
            final_action = action
    
    except Exception as e:
        print(f"  ✗ Reviewer turn failed: {e}")
        turns.append({"turn_id": 3, "role": "reviewer", "error": str(e)})
    
    return {
        "episode_id": episode_id,
        "case_id": case["id"],
        "model_id": model_id,
        "arm": "team_pressure" if pressure else "team_no_pressure",
        "structure": "team",
        "pressure": pressure,
        "turns": turns,
        "final_action": final_action,
        "complete": final_action is not None,
        "total_cost_usd": sum(t.get("cost_usd", 0) for t in turns)
    }


def run_swarm(
    config_path: Path,
    cases_path: Path,
    prompts_path: Path,
    output_dir: Path,
    budget_cap: float,
    dry_run: bool = False,
    resume_from: Optional[Path] = None,
    run_id: Optional[str] = None,
    ledger_path: Optional[Path] = None
) -> Dict:
    """
    Run swarm experiment.
    
    Args:
        config_path: Path to config.json
        cases_path: Path to cases.json
        prompts_path: Path to prompts.json
        output_dir: Directory for output manifest
        budget_cap: Budget cap in USD
        dry_run: If True, mock all API calls
        resume_from: Optional manifest to resume from
    
    Returns:
        Manifest dict with all results
    """
    # Load configuration
    config = load_config(config_path)
    cases_data = load_cases(cases_path)
    prompts = load_prompts(prompts_path)
    
    # Check for placeholders (stop execution if found)
    import json
    placeholder_check = json.dumps(cases_data) + json.dumps(prompts)
    if "[TO BE FINALIZED]" in placeholder_check:
        print("\n" + "="*60)
        print("ERROR: Placeholder content found in cases or prompts!")
        print("Files must not contain [TO BE FINALIZED] markers.")
        print("="*60)
        sys.exit(1)
    
    # Initialize budget tracker (use provided path or default)
    if ledger_path is None:
        ledger_path = Path(__file__).parent.parent / "ledger.db"
    budget_tracker = BudgetTracker(ledger_path, budget_cap)
    
    # Initialize provider client
    provider_client = ProviderClient(
        budget_tracker=budget_tracker,
        experiment="swarm",
        dry_run=dry_run
    )
    
    # Check budget status
    status = budget_tracker.get_status()
    print(f"\n{'='*60}")
    print(f"Swarm Experiment - Budget Status")
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
        run_id = f"swarm_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
    manifest = {
        "version": "1.0.0",
        "run_id": run_id,
        "created_at": datetime.utcnow().isoformat() + "Z",
        "dry_run": dry_run,
        "config": config,
        "cases_version": cases_data["version"],
        "prompts_version": prompts["version"],
        "method_hash": compute_method_hash(config_path, cases_path, prompts_path),
        "episodes": [],
        "summary": {
            "total_episodes": 0,
            "complete_episodes": 0,
            "incomplete_episodes": 0,
            "total_calls": 0,
            "total_cost_usd": 0.0,
            "by_model": {},
            "by_arm": {},
            "by_case": {}
        }
    }
    
    # Resume handling
    completed_episode_ids = set()
    if resume_from:
        print(f"Resuming from: {resume_from}")
        with open(resume_from) as f:
            prev_manifest = json.load(f)
            manifest["episodes"] = prev_manifest["episodes"]
            completed_episode_ids = {ep["episode_id"] for ep in manifest["episodes"]}
        print(f"  Already completed: {len(completed_episode_ids)} episodes\n")
    
    # Generate episode plan
    random.seed(config["randomization_seed"])
    
    episode_plan = []
    for case in cases_data["cases"]:
        for model_id in config["models"]:
            for arm_config in config["arms"]:
                n = config["n_per_arm"]
                
                for ep_idx in range(n):
                    episode_id = f"{case['id']}_{model_id.replace('/', '_')}_{arm_config['id']}_{ep_idx}"
                    
                    if episode_id not in completed_episode_ids:
                        episode_plan.append({
                            "episode_id": episode_id,
                            "case": case,
                            "model_id": model_id,
                            "arm_config": arm_config
                        })
    
    total_planned = len(episode_plan) + len(completed_episode_ids)
    print(f"Total episodes planned: {total_planned}")
    print(f"Already completed: {len(completed_episode_ids)}")
    print(f"Remaining: {len(episode_plan)}\n")
    
    if not episode_plan:
        print("No episodes remaining. Run complete!")
        return manifest
    
    # Execute episodes
    try:
        for i, ep_spec in enumerate(episode_plan, 1):
            print(f"[{i}/{len(episode_plan)}] {ep_spec['case']['id']} / {ep_spec['model_id']} / {ep_spec['arm_config']['id']}")
            
            # Run episode
            try:
                if ep_spec['arm_config']['structure'] == 'single':
                    episode = run_single_episode(
                        episode_id=ep_spec['episode_id'],
                        case=ep_spec['case'],
                        model_id=ep_spec['model_id'],
                        pressure=ep_spec['arm_config']['pressure'],
                        config=config,
                        prompts=prompts,
                        provider_client=provider_client,
                        run_id=run_id
                    )
                else:  # team
                    episode = run_team_episode(
                        episode_id=ep_spec['episode_id'],
                        case=ep_spec['case'],
                        model_id=ep_spec['model_id'],
                        pressure=ep_spec['arm_config']['pressure'],
                        config=config,
                        prompts=prompts,
                        provider_client=provider_client,
                        run_id=run_id
                    )
                
                manifest["episodes"].append(episode)
                
                # Update summary
                manifest["summary"]["total_episodes"] += 1
                if episode["complete"]:
                    manifest["summary"]["complete_episodes"] += 1
                else:
                    manifest["summary"]["incomplete_episodes"] += 1
                
                manifest["summary"]["total_calls"] += len(episode["turns"])
                manifest["summary"]["total_cost_usd"] += episode["total_cost_usd"]
                
                status = "✓" if episode["complete"] else "✗"
                print(f"  {status} Action: {episode['final_action'] or 'INCOMPLETE'} | ${episode['total_cost_usd']:.6f} | {len(episode['turns'])} turns")
                
                # Checkpoint every 5 episodes
                if i % 5 == 0:
                    checkpoint_path = output_dir / f"{run_id}_checkpoint.json"
                    with open(checkpoint_path, 'w') as f:
                        json.dump(manifest, f, indent=2)
                    print(f"  💾 Checkpoint saved")
            
            except BudgetExceededError as e:
                print(f"\n⚠️  BUDGET EXCEEDED: {e}")
                print(f"Stopping at episode {i}/{len(episode_plan)}")
                break
            except Exception as e:
                print(f"  ✗ ERROR: {e}")
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
    print(f"Swarm Complete")
    print(f"{'='*60}")
    print(f"Total episodes: {manifest['summary']['total_episodes']}")
    print(f"Complete: {manifest['summary']['complete_episodes']}")
    print(f"Incomplete: {manifest['summary']['incomplete_episodes']}")
    print(f"Total calls: {manifest['summary']['total_calls']}")
    print(f"Total cost: ${manifest['summary']['total_cost_usd']:.4f}")
    print(f"Manifest: {output_path}")
    print(f"{'='*60}\n")
    
    return manifest


def compute_method_hash(config_path: Path, cases_path: Path, prompts_path: Path) -> str:
    """Compute hash of method files for versioning."""
    hasher = hashlib.sha256()
    
    for path in [config_path, cases_path, prompts_path]:
        with open(path, 'rb') as f:
            hasher.update(f.read())
    
    return f"sha256:{hasher.hexdigest()}"


def compute_summary(manifest: Dict):
    """Compute summary statistics."""
    by_model = {}
    by_arm = {}
    by_case = {}
    
    for episode in manifest["episodes"]:
        model_id = episode["model_id"]
        arm = episode["arm"]
        case_id = episode["case_id"]
        
        for key, group_id in [(by_model, model_id), (by_arm, arm), (by_case, case_id)]:
            if group_id not in key:
                key[group_id] = {
                    "total": 0,
                    "complete": 0,
                    "incomplete": 0,
                    "cost_usd": 0.0,
                    "calls": 0
                }
            
            key[group_id]["total"] += 1
            key[group_id]["cost_usd"] += episode["total_cost_usd"]
            key[group_id]["calls"] += len(episode["turns"])
            
            if episode["complete"]:
                key[group_id]["complete"] += 1
            else:
                key[group_id]["incomplete"] += 1
    
    manifest["summary"]["by_model"] = by_model
    manifest["summary"]["by_arm"] = by_arm
    manifest["summary"]["by_case"] = by_case


def main():
    parser = argparse.ArgumentParser(
        description="Run swarm experiment"
    )
    parser.add_argument(
        "--config",
        type=Path,
        default=Path(__file__).parent / "config.json",
        help="Path to config.json"
    )
    parser.add_argument(
        "--cases",
        type=Path,
        default=Path(__file__).parent / "cases.json",
        help="Path to cases.json"
    )
    parser.add_argument(
        "--prompts",
        type=Path,
        default=Path(__file__).parent / "prompts.json",
        help="Path to prompts.json"
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
        default=60.0,
        help="Budget cap in USD (default: 60.00)"
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
        type=Path,
        help="Path to ledger.db (default: research/ledger.db)"
    )
    
    args = parser.parse_args()
    
    # Create output directory
    args.output_dir.mkdir(parents=True, exist_ok=True)
    
    # Run swarm
    run_swarm(
        config_path=args.config,
        cases_path=args.cases,
        prompts_path=args.prompts,
        output_dir=args.output_dir,
        budget_cap=args.budget_cap,
        dry_run=args.dry_run,
        resume_from=args.resume,
        run_id=args.run_id,
        ledger_path=args.ledger_path
    )


if __name__ == "__main__":
    main()
