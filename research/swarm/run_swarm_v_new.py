#!/usr/bin/env python3
"""
Swarm v_NEW: Scientifically controlled multi-agent comparison.

Acceptance checklist compliant:
- 3-call matched structure (single plan/review/act vs team worker/manager/reviewer)
- Full scenario facts in every role
- Case-specific pressure at middle phase only
- No baseline CEO career pressure
- Only final actor (turn 3) gets tools
- Hard 64-episode pilot cap (--pilot flag)
- Explicit outcome tracking (action/state/refusal/no_action/escalation)
- Protocol hash locking
"""

import argparse
import fcntl
import hashlib
import json
import os
import random
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any

# Add parent to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from lib.budget import BudgetTracker, BudgetExceededError
from lib.providers import Message, ProviderClient
from lib.models import MODELS, verify_model_availability


def compute_hash(obj: Any) -> str:
    """Compute SHA256 hash of JSON-serializable object."""
    return hashlib.sha256(json.dumps(obj, sort_keys=True).encode()).hexdigest()


def load_json(path: Path) -> Dict:
    """Load JSON file."""
    with open(path) as f:
        return json.load(f)


def format_evidence(evidence: Dict, prompts: Dict) -> str:
    """Format evidence dict using template."""
    template = prompts["evidence_format"]["template"]
    item_fmt = prompts["evidence_format"]["item_format"]
    items = "\n".join(
        item_fmt.format(key=k.replace("_", " "), value=v)
        for k, v in evidence.items()
    )
    return template.format(items=items)


def format_actions_list(case: Dict, prompts: Dict) -> str:
    """Format available actions list."""
    template = prompts["actions_list_format"]["template"]
    item_fmt = prompts["actions_list_format"]["item_format"]
    items = "\n".join(
        item_fmt.format(name=tool["function"]["name"], 
                       description=tool["function"]["description"])
        for tool in case["action_tools"]
    )
    return template.format(items=items)


def build_tool_definitions(case: Dict, provider: str) -> List[Dict]:
    """Build tool definitions in provider-specific format."""
    tools = case["action_tools"]
    if provider == "anthropic":
        return [
            {
                "name": t["function"]["name"],
                "description": t["function"]["description"],
                "input_schema": t["function"]["parameters"]
            }
            for t in tools
        ]
    else:
        return tools


def extract_tool_call(response: Any) -> Optional[Dict]:
    """Extract tool call from model response."""
    raw = getattr(response, 'raw_response', None)
    if raw is None:
        return None
    
    # Anthropic format
    if isinstance(raw, dict) and 'content' in raw:
        for block in raw['content']:
            if isinstance(block, dict) and block.get('type') == 'tool_use':
                return {
                    "name": block['name'],
                    "arguments": block.get('input', {})
                }
    
    # OpenAI format
    if isinstance(raw, dict) and 'choices' in raw:
        msg = raw['choices'][0].get('message', {})
        tool_calls = msg.get('tool_calls')
        if tool_calls and len(tool_calls) > 0:
            return {
                "name": tool_calls[0]['function']['name'],
                "arguments": json.loads(tool_calls[0]['function']['arguments'])
            }
    
    return None


def get_tool_outcome(tool_name: str, case: Dict) -> str:
    """Get deterministic outcome for tool call."""
    for tool in case["action_tools"]:
        if tool["function"]["name"] == tool_name:
            return tool["outcome"]
    return "Unknown tool"


def classify_outcome(tool_call: Optional[Dict], response_text: str) -> str:
    """Classify episode outcome."""
    if tool_call:
        return "action"
    if any(word in response_text.lower() for word in ["cannot", "refuse", "unable to"]):
        return "refusal"
    if any(word in response_text.lower() for word in ["escalate", "supervisor"]):
        return "escalation"
    return "no_action"


def run_episode_single(
    episode_id: int,
    case: Dict,
    arm: Dict,
    model_id: str,
    config: Dict,
    prompts: Dict,
    provider_client: ProviderClient,
    run_id: str
) -> Dict:
    """Execute 3-turn single agent episode: plan -> review -> action."""
    
    turns = []
    pressure = arm["pressure"]
    provider = model_id.split("/")[0]
    
    # Prepare common data
    evidence_fmt = format_evidence(case["evidence"], prompts)
    actions_list = format_actions_list(case, prompts)
    pressure_text = case.get("pressure_text", "")
    neutral_text = prompts["neutral_text"]
    
    # Turn 1: Plan (no tools)
    role1 = prompts["roles"]["single_plan"]
    prompt1 = role1["user_prompt"].format(
        scenario_text=case["scenario_text"],
        context=case["context"],
        evidence_formatted=evidence_fmt,
        actions_list=actions_list,
        pressure_or_neutral=neutral_text
    )
    
    messages = [
        Message(role="system", content=role1["system"]),
        Message(role="user", content=prompt1)
    ]
    
    try:
        resp1 = provider_client.call_model(
            call_id=f"{run_id}_{episode_id}_turn1",
            model_id=model_id,
            messages=messages,
            tools=None,  # No tools on turn 1
            max_tokens=config["sampling"]["max_tokens"],
            temperature=config["sampling"]["temperature"]
        )
        
        turn1_text = resp1.content if hasattr(resp1, 'content') else str(resp1)
        turns.append({
            "turn": 1,
            "role": "single_plan",
            "tools_available": False,
            "cost_usd": resp1.actual_cost_usd,
            "prompt_hash": compute_hash(prompt1)
        })
        
    except Exception as e:
        return {
            "episode_id": episode_id,
            "status": "error",
            "error": str(e),
            "turn": 1
        }
    
    # Turn 2: Review with pressure (no tools)
    role2 = prompts["roles"]["single_review"]
    prompt2 = role2["user_prompt"].format(
        turn1_message=turn1_text,
        scenario_text=case["scenario_text"],
        context=case["context"],
        evidence_formatted=evidence_fmt,
        actions_list=actions_list,
        pressure_or_neutral=(pressure_text if pressure else neutral_text)
    )
    
    messages.append(Message(role="assistant", content=turn1_text))
    messages.append(Message(role="user", content=prompt2))
    
    try:
        resp2 = provider_client.call_model(
            call_id=f"{run_id}_{episode_id}_turn2",
            model_id=model_id,
            messages=messages,
            tools=None,  # No tools on turn 2
            max_tokens=config["sampling"]["max_tokens"],
            temperature=config["sampling"]["temperature"]
        )
        
        turn2_text = resp2.content if hasattr(resp2, 'content') else str(resp2)
        turns.append({
            "turn": 2,
            "role": "single_review",
            "tools_available": False,
            "pressure_applied": pressure,
            "cost_usd": resp2.actual_cost_usd,
            "prompt_hash": compute_hash(prompt2)
        })
        
    except Exception as e:
        return {
            "episode_id": episode_id,
            "status": "error",
            "error": str(e),
            "turn": 2
        }
    
    # Turn 3: Action with tools
    role3 = prompts["roles"]["single_action"]
    prompt3 = role3["user_prompt"].format(
        turn1_message=turn1_text,
        turn2_message=turn2_text,
        scenario_text=case["scenario_text"],
        context=case["context"],
        evidence_formatted=evidence_fmt,
        pressure_or_neutral=neutral_text
    )
    
    tools = build_tool_definitions(case, provider)
    
    messages.append(Message(role="assistant", content=turn2_text))
    messages.append(Message(role="user", content=prompt3))
    
    try:
        resp3 = provider_client.call_model(
            call_id=f"{run_id}_{episode_id}_turn3",
            model_id=model_id,
            messages=messages,
            tools=tools,  # ONLY turn 3 gets tools
            max_tokens=config["sampling"]["max_tokens"],
            temperature=config["sampling"]["temperature"]
        )
        
        tool_call = extract_tool_call(resp3)
        turn3_text = resp3.content if hasattr(resp3, 'content') else str(resp3)
        
        turns.append({
            "turn": 3,
            "role": "single_action",
            "tools_available": True,
            "tool_call": tool_call["name"] if tool_call else None,
            "cost_usd": resp3.actual_cost_usd,
            "prompt_hash": compute_hash(prompt3),
            "tools_hash": compute_hash(tools)
        })
        
        total_cost = sum(t.get("cost_usd", 0) for t in turns)
        
        return {
            "episode_id": episode_id,
            "case_id": case["id"],
            "model_id": model_id,
            "arm": arm["id"],
            "structure": "single",
            "pressure": pressure,
            "turns": turns,
            "final_action": tool_call["name"] if tool_call else None,
            "outcome": classify_outcome(tool_call, turn3_text),
            "tool_outcome": get_tool_outcome(tool_call["name"], case) if tool_call else None,
            "total_calls": 3,
            "total_cost_usd": total_cost,
            "status": "complete"
        }
        
    except Exception as e:
        return {
            "episode_id": episode_id,
            "status": "error",
            "error": str(e),
            "turn": 3
        }


def run_episode_team(
    episode_id: int,
    case: Dict,
    arm: Dict,
    model_id: str,
    config: Dict,
    prompts: Dict,
    provider_client: ProviderClient,
    run_id: str
) -> Dict:
    """Execute 3-turn team episode: worker -> manager -> reviewer."""
    
    turns = []
    pressure = arm["pressure"]
    provider = model_id.split("/")[0]
    
    # Prepare common data
    evidence_fmt = format_evidence(case["evidence"], prompts)
    actions_list = format_actions_list(case, prompts)
    pressure_text = case.get("pressure_text", "")
    neutral_text = prompts["neutral_text"]
    
    # Turn 1: Worker (no tools)
    role1 = prompts["roles"]["team_worker"]
    prompt1 = role1["user_prompt"].format(
        scenario_text=case["scenario_text"],
        context=case["context"],
        evidence_formatted=evidence_fmt,
        actions_list=actions_list,
        pressure_or_neutral=neutral_text
    )
    
    messages = [
        Message(role="system", content=role1["system"]),
        Message(role="user", content=prompt1)
    ]
    
    try:
        resp1 = provider_client.call_model(
            call_id=f"{run_id}_{episode_id}_turn1",
            model_id=model_id,
            messages=messages,
            tools=None,
            max_tokens=config["sampling"]["max_tokens"],
            temperature=config["sampling"]["temperature"]
        )
        
        turn1_text = resp1.content if hasattr(resp1, 'content') else str(resp1)
        turns.append({
            "turn": 1,
            "role": "team_worker",
            "tools_available": False,
            "cost_usd": resp1.actual_cost_usd,
            "prompt_hash": compute_hash(prompt1)
        })
        
    except Exception as e:
        return {
            "episode_id": episode_id,
            "status": "error",
            "error": str(e),
            "turn": 1
        }
    
    # Turn 2: Manager with pressure (no tools)
    role2 = prompts["roles"]["team_manager"]
    prompt2 = role2["user_prompt"].format(
        turn1_message=turn1_text,
        scenario_text=case["scenario_text"],
        context=case["context"],
        evidence_formatted=evidence_fmt,
        actions_list=actions_list,
        pressure_or_neutral=(pressure_text if pressure else neutral_text)
    )
    
    messages = [
        Message(role="system", content=role2["system"]),
        Message(role="user", content=prompt2)
    ]
    
    try:
        resp2 = provider_client.call_model(
            call_id=f"{run_id}_{episode_id}_turn2",
            model_id=model_id,
            messages=messages,
            tools=None,
            max_tokens=config["sampling"]["max_tokens"],
            temperature=config["sampling"]["temperature"]
        )
        
        turn2_text = resp2.content if hasattr(resp2, 'content') else str(resp2)
        turns.append({
            "turn": 2,
            "role": "team_manager",
            "tools_available": False,
            "pressure_applied": pressure,
            "cost_usd": resp2.actual_cost_usd,
            "prompt_hash": compute_hash(prompt2)
        })
        
    except Exception as e:
        return {
            "episode_id": episode_id,
            "status": "error",
            "error": str(e),
            "turn": 2
        }
    
    # Turn 3: Reviewer with tools
    role3 = prompts["roles"]["team_reviewer"]
    prompt3 = role3["user_prompt"].format(
        turn1_message=turn1_text,
        turn2_message=turn2_text,
        scenario_text=case["scenario_text"],
        context=case["context"],
        evidence_formatted=evidence_fmt,
        pressure_or_neutral=neutral_text
    )
    
    tools = build_tool_definitions(case, provider)
    
    messages = [
        Message(role="system", content=role3["system"]),
        Message(role="user", content=prompt3)
    ]
    
    try:
        resp3 = provider_client.call_model(
            call_id=f"{run_id}_{episode_id}_turn3",
            model_id=model_id,
            messages=messages,
            tools=tools,
            max_tokens=config["sampling"]["max_tokens"],
            temperature=config["sampling"]["temperature"]
        )
        
        tool_call = extract_tool_call(resp3)
        turn3_text = resp3.content if hasattr(resp3, 'content') else str(resp3)
        
        turns.append({
            "turn": 3,
            "role": "team_reviewer",
            "tools_available": True,
            "tool_call": tool_call["name"] if tool_call else None,
            "cost_usd": resp3.actual_cost_usd,
            "prompt_hash": compute_hash(prompt3),
            "tools_hash": compute_hash(tools)
        })
        
        total_cost = sum(t.get("cost_usd", 0) for t in turns)
        
        return {
            "episode_id": episode_id,
            "case_id": case["id"],
            "model_id": model_id,
            "arm": arm["id"],
            "structure": "team",
            "pressure": pressure,
            "turns": turns,
            "final_action": tool_call["name"] if tool_call else None,
            "outcome": classify_outcome(tool_call, turn3_text),
            "tool_outcome": get_tool_outcome(tool_call["name"], case) if tool_call else None,
            "total_calls": 3,
            "total_cost_usd": total_cost,
            "status": "complete"
        }
        
    except Exception as e:
        return {
            "episode_id": episode_id,
            "status": "error",
            "error": str(e),
            "turn": 3
        }


def generate_schedule(config: Dict, cases: Dict, pilot: bool = False) -> List[Dict]:
    """Generate episode schedule."""
    episodes = []
    n = config["pilot_episodes"] if pilot else config["full_episodes"]
    
    for case_idx, case in enumerate(cases["cases"]):
        for arm_idx, arm in enumerate(config["arms"]):
            for model_idx, model in enumerate(config["models"]):
                for ep in range(n):
                    episodes.append({
                        "episode_id": len(episodes),
                        "case_id": case["id"],
                        "arm_id": arm["id"],
                        "model_id": model,
                        "structure": arm["structure"]
                    })
    
    # Shuffle for balance
    random.seed(config["randomization_seed"])
    random.shuffle(episodes)
    
    return episodes


def save_protocol_hashes(config: Dict, cases: Dict, prompts: Dict, output_dir: Path):
    """Save protocol hashes for verification."""
    hashes = {
        "config_hash": compute_hash(config),
        "cases_hash": compute_hash(cases),
        "prompts_hash": compute_hash(prompts),
        "timestamp": datetime.now().isoformat()
    }
    
    with open(output_dir / "protocol_hashes.json", "w") as f:
        json.dump(hashes, f, indent=2)
    
    return hashes


def main():
    parser = argparse.ArgumentParser(description="Swarm v_NEW experiment")
    parser.add_argument("--pilot", action="store_true", 
                       help="Run 64-episode pilot (4 cases × 4 arms × 4 models × 1)")
    parser.add_argument("--mock", action="store_true",
                       help="Mock mode: no API calls, $0 cost")
    parser.add_argument("--max-cost", type=float, default=10.0,
                       help="Maximum incremental cost for this run (default: $10)")
    
    args = parser.parse_args()
    
    # Load config files
    swarm_dir = Path(__file__).parent
    config = load_json(swarm_dir / "config_v_new.json")
    cases = load_json(swarm_dir / "cases_v_new.json")
    prompts = load_json(swarm_dir / "prompts_v_new.json")
    
    # Verify models
    print("Verifying model availability...")
    availability = verify_model_availability()
    for model_id in config["models"]:
        if model_id not in MODELS:
            print(f"❌ Unknown model: {model_id}")
            return 1
        if not availability.get(model_id, False):
            print(f"⚠️  Model unavailable: {model_id}")
    print("✓ All models configured")
    
    # Generate schedule
    schedule = generate_schedule(config, cases, pilot=args.pilot)
    
    total_calls = len(schedule) * 3  # 3 calls per episode
    print(f"\n{'PILOT' if args.pilot else 'FULL'} RUN:")
    print(f"  Episodes: {len(schedule)}")
    print(f"  Total calls: {total_calls}")
    print(f"  Cases: {len(cases['cases'])}")
    print(f"  Arms: {len(config['arms'])}")
    print(f"  Models: {len(config['models'])}")
    
    if args.pilot and len(schedule) != 64:
        print(f"\n❌ ERROR: Pilot should be 64 episodes, got {len(schedule)}")
        return 1
    
    # Initialize output
    run_id = f"swarm_v_new_{'pilot' if args.pilot else 'full'}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    output_dir = swarm_dir / "output" / run_id
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Save protocol hashes
    hashes = save_protocol_hashes(config, cases, prompts, output_dir)
    print(f"\nProtocol hashes:")
    print(f"  Config: {hashes['config_hash'][:16]}...")
    print(f"  Cases: {hashes['cases_hash'][:16]}...")
    print(f"  Prompts: {hashes['prompts_hash'][:16]}...")
    
    if args.mock:
        print("\n✓ MOCK MODE: Dry run complete (0 API calls, $0 cost)")
        print(f"  Schedule verified: {len(schedule)} episodes × 3 calls = {total_calls} total")
        return 0
    
    # Initialize budget tracker
    budget_db = swarm_dir.parent / "data" / "ledger.db"
    budget = BudgetTracker(budget_db, max_incremental_cost_usd=args.max_cost)
    
    # Initialize provider client
    provider_client = ProviderClient(budget_tracker=budget)
    
    print(f"\n🚀 Starting {len(schedule)} episodes...")
    
    results = []
    case_map = {c["id"]: c for c in cases["cases"]}
    arm_map = {a["id"]: a for a in config["arms"]}
    
    for i, ep in enumerate(schedule):
        case = case_map[ep["case_id"]]
        arm = arm_map[ep["arm_id"]]
        
        print(f"\n[{i+1}/{len(schedule)}] Episode {ep['episode_id']}: "
              f"{ep['case_id']} / {ep['arm_id']} / {ep['model_id']}")
        
        try:
            if ep["structure"] == "single":
                result = run_episode_single(
                    ep["episode_id"], case, arm, ep["model_id"],
                    config, prompts, provider_client, run_id
                )
            else:
                result = run_episode_team(
                    ep["episode_id"], case, arm, ep["model_id"],
                    config, prompts, provider_client, run_id
                )
            
            results.append(result)
            
            if result["status"] == "complete":
                print(f"  ✓ {result['final_action'] or 'no_action'} "
                      f"(${result['total_cost_usd']:.4f})")
            else:
                print(f"  ✗ {result['status']}: {result.get('error', 'unknown')}")
                
        except BudgetExceededError as e:
            print(f"\n❌ BUDGET EXCEEDED: {e}")
            print(f"   Completed {i}/{len(schedule)} episodes")
            break
        except Exception as e:
            print(f"  ✗ Unexpected error: {e}")
            results.append({
                "episode_id": ep["episode_id"],
                "status": "error",
                "error": str(e)
            })
    
    # Save results
    output_file = output_dir / "results.json"
    with open(output_file, "w") as f:
        json.dump({
            "run_id": run_id,
            "pilot": args.pilot,
            "episodes_completed": len(results),
            "total_calls": sum(r.get("total_calls", 0) for r in results),
            "total_cost_usd": sum(r.get("total_cost_usd", 0) for r in results),
            "protocol_hashes": hashes,
            "results": results
        }, f, indent=2)
    
    print(f"\n✅ Results saved: {output_file}")
    print(f"   Completed: {len([r for r in results if r.get('status') == 'complete'])}/{len(schedule)}")
    print(f"   Total cost: ${sum(r.get('total_cost_usd', 0) for r in results):.4f}")
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
