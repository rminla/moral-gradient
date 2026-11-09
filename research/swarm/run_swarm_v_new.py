#!/usr/bin/env python3
"""
Swarm v_NEW: Scientifically controlled multi-agent comparison (FIXED).

All acceptance blockers addressed:
1. Correct lib imports (journal.py included)
2. BudgetTracker(db_path, global_cap_usd) signature
3. Correct ledger path (runs/v4-20261108/ledger.db, $70 absolute cap)
4. Mock mode exercises full SDK path with mock transport
5. --pilot REQUIRED, full 1920 blocked
6. Full traces (prompts, tools, responses, args, hashes)
7. Context parity: both final actors see full history + neutral text
8. 8-message cap enforced
9. Fixed outcome classification (escalate_to_supervisor is escalation not action)
10. Context-appropriate neutral text
"""

import argparse
import hashlib
import json
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple

# Add parent to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from lib.budget import BudgetTracker, BudgetExceededError
from lib.providers import Message, ProviderClient
from lib.models import MODELS

# Swarm-specific modules
from stage_budget import StageBudgetEnforcer
from case_environment import CaseEnvironment
from outcome_categories import TOOL_OUTCOME_MAP, classify_outcome as classify_outcome_explicit


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
    """
    Extract tool call from model response.
    
    Returns:
        {"name": str, "arguments": dict} for valid tool call
        {"name": str, "arguments": None, "malformed": True} for malformed
        None for no tool call
    """
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
            func = tool_calls[0].get('function', {})
            name = func.get('name')
            args_str = func.get('arguments', '{}')
            
            # Try to parse arguments JSON
            try:
                arguments = json.loads(args_str)
                return {
                    "name": name,
                    "arguments": arguments
                }
            except (json.JSONDecodeError, TypeError):
                # Malformed arguments - don't crash episode
                return {
                    "name": name,
                    "arguments": None,
                    "malformed": True
                }
    
    return None


def get_tool_outcome(tool_name: str, case: Dict) -> str:
    """Get deterministic outcome for tool call."""
    for tool in case["action_tools"]:
        if tool["function"]["name"] == tool_name:
            return tool["outcome"]
    return f"Unknown tool: {tool_name}"


# classify_outcome moved to outcome_categories.py


def get_neutral_text(case_id: str, prompts: Dict) -> str:
    """Get context-appropriate neutral text."""
    # Personal decision cases use personal framing
    personal_cases = {"powerbank", "bonus_split"}
    
    if case_id in personal_cases:
        return prompts.get("neutral_text_personal", prompts["neutral_text"])
    else:
        return prompts["neutral_text"]


def run_episode_single(
    episode_id: int,
    case: Dict,
    arm: Dict,
    model_id: str,
    config: Dict,
    prompts: Dict,
    provider_client: ProviderClient,
    run_id: str,
    trace_dir: Path
) -> Dict:
    """Execute 3-turn single agent episode with full tracing."""
    
    turns = []
    pressure = arm["pressure"]
    provider = model_id.split("/")[0]
    message_count = 0
    
    # Prepare common data
    evidence_fmt = format_evidence(case["evidence"], prompts)
    actions_list = format_actions_list(case, prompts)
    pressure_text = case.get("pressure_text", "")
    neutral_text = get_neutral_text(case["id"], prompts)
    
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
    
    message_count += 1
    if message_count > 8:
        return {"episode_id": episode_id, "status": "error", "error": "8-message cap exceeded", "turn": 1}
    
    try:
        resp1 = provider_client.call_model(
            call_id=f"{run_id}_{episode_id}_single_turn1",
            model_id=model_id,
            messages=messages,
            tools=None,
            max_tokens=config["sampling"]["max_tokens"],
            temperature=config["sampling"]["temperature"],
            metadata={"episode_id": episode_id, "turn": 1, "role": "single_plan"}
        )
        
        turn1_text = resp1.content if hasattr(resp1, 'content') else str(resp1)
        
        turn1_trace = {
            "turn": 1,
            "role": "single_plan",
            "tools_available": False,
            "system_prompt": role1["system"],
            "user_prompt": prompt1,
            "prompt_hash": compute_hash(prompt1),
            "response_text": turn1_text,
            "model_version": resp1.model_version,
            "usage": resp1.usage,
            "cost_usd": resp1.actual_cost_usd,
            "tool_call": None
        }
        turns.append(turn1_trace)
        
    except Exception as e:
        return {"episode_id": episode_id, "status": "error", "error": str(e), "turn": 1}
    
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
    
    message_count += 1
    if message_count > 8:
        return {"episode_id": episode_id, "status": "error", "error": "8-message cap exceeded", "turn": 2}
    
    try:
        resp2 = provider_client.call_model(
            call_id=f"{run_id}_{episode_id}_single_turn2",
            model_id=model_id,
            messages=messages,
            tools=None,
            max_tokens=config["sampling"]["max_tokens"],
            temperature=config["sampling"]["temperature"],
            metadata={"episode_id": episode_id, "turn": 2, "role": "single_review"}
        )
        
        turn2_text = resp2.content if hasattr(resp2, 'content') else str(resp2)
        
        turn2_trace = {
            "turn": 2,
            "role": "single_review",
            "tools_available": False,
            "pressure_applied": pressure,
            "system_prompt": role2["system"],
            "user_prompt": prompt2,
            "prompt_hash": compute_hash(prompt2),
            "response_text": turn2_text,
            "model_version": resp2.model_version,
            "usage": resp2.usage,
            "cost_usd": resp2.actual_cost_usd,
            "tool_call": None
        }
        turns.append(turn2_trace)
        
    except Exception as e:
        return {"episode_id": episode_id, "status": "error", "error": str(e), "turn": 2}
    
    # Turn 3: Action with tools
    # CONTEXT PARITY FIX: Fresh context for turn 3, no reproduction of turn 2 pressure prompt
    # Only include: scenario + turn summaries + neutral (parallel to team structure)
    role3 = prompts["roles"]["single_action"]
    prompt3 = role3["user_prompt"].format(
        turn1_message=turn1_text,
        turn2_message=turn2_text,
        scenario_text=case["scenario_text"],
        context=case["context"],
        evidence_formatted=evidence_fmt,
        actions_list=actions_list,
        pressure_or_neutral=neutral_text  # Always neutral on turn 3
    )
    
    tools = build_tool_definitions(case, provider)
    
    # CONTEXT PARITY: Start fresh message context for turn 3 (don't carry turn 2 pressure)
    messages = [
        Message(role="system", content=role3["system"]),
        Message(role="user", content=prompt3)
    ]
    
    message_count += 1
    if message_count > 8:
        return {"episode_id": episode_id, "status": "error", "error": "8-message cap exceeded", "turn": 3}
    
    try:
        resp3 = provider_client.call_model(
            call_id=f"{run_id}_{episode_id}_single_turn3",
            model_id=model_id,
            messages=messages,
            tools=tools,
            max_tokens=config["sampling"]["max_tokens"],
            temperature=config["sampling"]["temperature"],
            metadata={"episode_id": episode_id, "turn": 3, "role": "single_action"}
        )
        
        tool_call = extract_tool_call(resp3)
        turn3_text = resp3.content if hasattr(resp3, 'content') else str(resp3)
        
        # Execute tool in simulated environment
        env = CaseEnvironment(case["id"])
        tool_execution = None
        if tool_call and not tool_call.get("malformed"):
            tool_execution = env.execute_tool(
                tool_call["name"],
                tool_call.get("arguments", {})
            )
        
        turn3_trace = {
            "turn": 3,
            "role": "single_action",
            "tools_available": True,
            "tools_provided": [t["function"]["name"] if "function" in t else t["name"] for t in tools],
            "system_prompt": role3["system"],
            "user_prompt": prompt3,
            "prompt_hash": compute_hash(prompt3),
            "tools_hash": compute_hash(tools),
            "response_text": turn3_text,
            "model_version": resp3.model_version,
            "usage": resp3.usage,
            "cost_usd": resp3.actual_cost_usd,
            "tool_call": tool_call,
            "tool_execution": tool_execution  # State changes recorded
        }
        turns.append(turn3_trace)
        
        total_cost = sum(t.get("cost_usd", 0) for t in turns)
        outcome = classify_outcome_explicit(tool_call, turn3_text, case["action_tools"])
        
        result = {
            "episode_id": episode_id,
            "case_id": case["id"],
            "model_id": model_id,
            "arm": arm["id"],
            "structure": "single",
            "pressure": pressure,
            "turns": turns,
            "final_action": tool_call["name"] if tool_call else None,
            "tool_arguments": tool_call.get("arguments") if tool_call else None,
            "outcome": outcome,
            "tool_outcome_text": get_tool_outcome(tool_call["name"], case) if tool_call else None,
            "total_calls": 3,
            "total_messages": message_count,
            "total_cost_usd": total_cost,
            "status": "complete"
        }
        
        # Write full trace
        trace_file = trace_dir / f"episode_{episode_id:04d}.json"
        with open(trace_file, "w") as f:
            json.dump(result, f, indent=2)
        
        return result
        
    except Exception as e:
        return {"episode_id": episode_id, "status": "error", "error": str(e), "turn": 3}


def run_episode_team(
    episode_id: int,
    case: Dict,
    arm: Dict,
    model_id: str,
    config: Dict,
    prompts: Dict,
    provider_client: ProviderClient,
    run_id: str,
    trace_dir: Path
) -> Dict:
    """Execute 3-turn team episode with context parity fix."""
    
    turns = []
    pressure = arm["pressure"]
    provider = model_id.split("/")[0]
    message_count = 0
    
    # Prepare common data
    evidence_fmt = format_evidence(case["evidence"], prompts)
    actions_list = format_actions_list(case, prompts)
    pressure_text = case.get("pressure_text", "")
    neutral_text = get_neutral_text(case["id"], prompts)
    
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
    
    message_count += 1
    if message_count > 8:
        return {"episode_id": episode_id, "status": "error", "error": "8-message cap exceeded", "turn": 1}
    
    try:
        resp1 = provider_client.call_model(
            call_id=f"{run_id}_{episode_id}_team_turn1",
            model_id=model_id,
            messages=messages,
            tools=None,
            max_tokens=config["sampling"]["max_tokens"],
            temperature=config["sampling"]["temperature"],
            metadata={"episode_id": episode_id, "turn": 1, "role": "team_worker"}
        )
        
        turn1_text = resp1.content if hasattr(resp1, 'content') else str(resp1)
        
        turn1_trace = {
            "turn": 1,
            "role": "team_worker",
            "tools_available": False,
            "system_prompt": role1["system"],
            "user_prompt": prompt1,
            "prompt_hash": compute_hash(prompt1),
            "response_text": turn1_text,
            "model_version": resp1.model_version,
            "usage": resp1.usage,
            "cost_usd": resp1.actual_cost_usd,
            "tool_call": None
        }
        turns.append(turn1_trace)
        
    except Exception as e:
        return {"episode_id": episode_id, "status": "error", "error": str(e), "turn": 1}
    
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
    
    message_count += 1
    if message_count > 8:
        return {"episode_id": episode_id, "status": "error", "error": "8-message cap exceeded", "turn": 2}
    
    try:
        resp2 = provider_client.call_model(
            call_id=f"{run_id}_{episode_id}_team_turn2",
            model_id=model_id,
            messages=messages,
            tools=None,
            max_tokens=config["sampling"]["max_tokens"],
            temperature=config["sampling"]["temperature"],
            metadata={"episode_id": episode_id, "turn": 2, "role": "team_manager"}
        )
        
        turn2_text = resp2.content if hasattr(resp2, 'content') else str(resp2)
        
        turn2_trace = {
            "turn": 2,
            "role": "team_manager",
            "tools_available": False,
            "pressure_applied": pressure,
            "system_prompt": role2["system"],
            "user_prompt": prompt2,
            "prompt_hash": compute_hash(prompt2),
            "response_text": turn2_text,
            "model_version": resp2.model_version,
            "usage": resp2.usage,
            "cost_usd": resp2.actual_cost_usd,
            "tool_call": None
        }
        turns.append(turn2_trace)
        
    except Exception as e:
        return {"episode_id": episode_id, "status": "error", "error": str(e), "turn": 2}
    
    # Turn 3: Reviewer with tools
    # CONTEXT PARITY FIX: Include full scenario + neutral (parallel to single turn 3)
    role3 = prompts["roles"]["team_reviewer"]
    prompt3 = role3["user_prompt"].format(
        turn1_message=turn1_text,
        turn2_message=turn2_text,
        scenario_text=case["scenario_text"],
        context=case["context"],
        evidence_formatted=evidence_fmt,
        actions_list=actions_list,
        pressure_or_neutral=neutral_text  # Always neutral on turn 3
    )
    
    tools = build_tool_definitions(case, provider)
    
    messages = [
        Message(role="system", content=role3["system"]),
        Message(role="user", content=prompt3)
    ]
    
    message_count += 1
    if message_count > 8:
        return {"episode_id": episode_id, "status": "error", "error": "8-message cap exceeded", "turn": 3}
    
    try:
        resp3 = provider_client.call_model(
            call_id=f"{run_id}_{episode_id}_team_turn3",
            model_id=model_id,
            messages=messages,
            tools=tools,
            max_tokens=config["sampling"]["max_tokens"],
            temperature=config["sampling"]["temperature"],
            metadata={"episode_id": episode_id, "turn": 3, "role": "team_reviewer"}
        )
        
        tool_call = extract_tool_call(resp3)
        turn3_text = resp3.content if hasattr(resp3, 'content') else str(resp3)
        
        # Execute tool in simulated environment
        env = CaseEnvironment(case["id"])
        tool_execution = None
        if tool_call and not tool_call.get("malformed"):
            tool_execution = env.execute_tool(
                tool_call["name"],
                tool_call.get("arguments", {})
            )
        
        turn3_trace = {
            "turn": 3,
            "role": "team_reviewer",
            "tools_available": True,
            "tools_provided": [t["function"]["name"] if "function" in t else t["name"] for t in tools],
            "system_prompt": role3["system"],
            "user_prompt": prompt3,
            "prompt_hash": compute_hash(prompt3),
            "tools_hash": compute_hash(tools),
            "response_text": turn3_text,
            "model_version": resp3.model_version,
            "usage": resp3.usage,
            "cost_usd": resp3.actual_cost_usd,
            "tool_call": tool_call,
            "tool_execution": tool_execution  # State changes recorded
        }
        turns.append(turn3_trace)
        
        total_cost = sum(t.get("cost_usd", 0) for t in turns)
        outcome = classify_outcome_explicit(tool_call, turn3_text, case["action_tools"])
        
        result = {
            "episode_id": episode_id,
            "case_id": case["id"],
            "model_id": model_id,
            "arm": arm["id"],
            "structure": "team",
            "pressure": pressure,
            "turns": turns,
            "final_action": tool_call["name"] if tool_call else None,
            "tool_arguments": tool_call.get("arguments") if tool_call else None,
            "outcome": outcome,
            "tool_outcome_text": get_tool_outcome(tool_call["name"], case) if tool_call else None,
            "total_calls": 3,
            "total_messages": message_count,
            "total_cost_usd": total_cost,
            "status": "complete"
        }
        
        # Write full trace
        trace_file = trace_dir / f"episode_{episode_id:04d}.json"
        with open(trace_file, "w") as f:
            json.dump(result, f, indent=2)
        
        return result
        
    except Exception as e:
        return {"episode_id": episode_id, "status": "error", "error": str(e), "turn": 3}


def generate_schedule(config: Dict, cases: Dict, n_episodes: int) -> List[Dict]:
    """Generate episode schedule."""
    import random
    
    episodes = []
    for case in cases["cases"]:
        for arm in config["arms"]:
            for model in config["models"]:
                for ep in range(n_episodes):
                    episodes.append({
                        "episode_id": len(episodes),
                        "case_id": case["id"],
                        "arm_id": arm["id"],
                        "model_id": model,
                        "structure": arm["structure"]
                    })
    
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
    parser = argparse.ArgumentParser(description="Swarm v_NEW experiment (FIXED)")
    parser.add_argument("--pilot", action="store_true", required=True,
                       help="REQUIRED: Run 64-episode pilot (4×4×4×1). Full run blocked.")
    parser.add_argument("--mock", action="store_true",
                       help="Mock mode: uses SDK mock transport, no network, disposable ledger")
    parser.add_argument("--ledger-path", type=str, required=True,
                       help="REQUIRED: Path to existing ledger.db (e.g. runs/v4-20261108/ledger.db)")
    parser.add_argument("--global-cap", type=float, default=70.0,
                       help="Absolute global cap in USD including all prior holds (default: $70)")
    parser.add_argument("--stage-cap", type=float, default=5.0,
                       help="Incremental cap for pilot stage (default: $5)")
    parser.add_argument("--baseline-locked", type=float, default=None,
                       help="Override baseline (if omitted, computed from ledger)")
    
    args = parser.parse_args()
    
    # Enforce pilot requirement
    if not args.pilot:
        print("❌ ERROR: --pilot flag is REQUIRED. Full 1920-episode run is blocked.")
        return 1
    
    # Load config files
    swarm_dir = Path(__file__).parent
    config = load_json(swarm_dir / "config_v_new.json")
    cases = load_json(swarm_dir / "cases_v_new.json")
    prompts = load_json(swarm_dir / "prompts_v_new.json")
    
    # Verify models
    print("Verifying model availability...")
    from lib.models import verify_model_availability
    availability = verify_model_availability()
    for model_id in config["models"]:
        if model_id not in MODELS:
            print(f"❌ Unknown model: {model_id}")
            return 1
        if not availability.get(model_id, False):
            print(f"⚠️  Model unavailable: {model_id}")
    print("✓ All models configured")
    
    # Generate schedule: HARD 64 for pilot
    n_episodes = 1  # HARD-CODED: 1 episode per case/arm/model combo = 64 total
    schedule = generate_schedule(config, cases, n_episodes)
    
    total_calls = len(schedule) * 3
    
    # HARD ENFORCE 64 episodes / 192 calls
    if len(schedule) != 64 or total_calls != 192:
        print(f"❌ INTERNAL ERROR: Pilot must be exactly 64 episodes / 192 calls")
        print(f"   Got: {len(schedule)} episodes / {total_calls} calls")
        return 1
    
    print(f"\n🔒 PILOT RUN (HARD BOUNDED):")
    print(f"  Episodes: {len(schedule)} (EXACTLY 64)")
    print(f"  Total calls: {total_calls} (EXACTLY 192)")
    print(f"  Max calls per episode: 3")
    print(f"  Cases: {len(cases['cases'])}")
    print(f"  Arms: {len(config['arms'])}")
    print(f"  Models: {len(config['models'])}")
    
    # Initialize output
    run_id = f"swarm_v_new_pilot_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    output_dir = swarm_dir / "output" / run_id
    output_dir.mkdir(parents=True, exist_ok=True)
    
    trace_dir = output_dir / "traces"
    trace_dir.mkdir(exist_ok=True)
    
    # Save protocol hashes
    hashes = save_protocol_hashes(config, cases, prompts, output_dir)
    print(f"\nProtocol hashes:")
    print(f"  Config: {hashes['config_hash'][:16]}...")
    print(f"  Cases: {hashes['cases_hash'][:16]}...")
    print(f"  Prompts: {hashes['prompts_hash'][:16]}...")
    
    if args.mock:
        print(f"\n🧪 MOCK MODE: Using SDK mock transport")
        print(f"   Disposable sandbox ledger (no writes to live DB)")
        print(f"   Full SDK call path exercised")
        
        # Create disposable mock ledger
        mock_ledger = output_dir / "mock_ledger.db"
        budget = BudgetTracker(mock_ledger, global_cap_usd=args.global_cap)
        provider_client = ProviderClient(
            budget_tracker=budget,
            experiment="swarm",
            dry_run=True,  # Mock transport
            journal_dir=output_dir / "mock_journal"
        )
    else:
        # Real run: use specified ledger with conservative caps
        ledger_path = Path(args.ledger_path)
        if not ledger_path.exists():
            print(f"❌ ERROR: Ledger not found: {ledger_path}")
            print(f"   Specify existing ledger with --ledger-path")
            return 1
        
        print(f"\n💰 BUDGET CONFIGURATION:")
        print(f"   Ledger: {ledger_path}")
        print(f"   Absolute global cap: ${args.global_cap:.2f}")
        print(f"   Stage incremental cap: ${args.stage_cap:.2f}")
        
        budget = BudgetTracker(ledger_path, global_cap_usd=args.global_cap)
        
        # Wrap with stage budget enforcer (computes baseline from ledger if not provided)
        stage_budget = StageBudgetEnforcer(
            budget_tracker=budget,
            stage_cap_usd=args.stage_cap,
            baseline_locked_usd=args.baseline_locked  # None = compute from ledger
        )
        
        # Preflight check
        status = stage_budget.get_status()
        print(f"\n📊 PREFLIGHT:")
        print(f"   Global reserved: ${status['global_reserved_usd']:.4f}")
        print(f"   Global spent: ${status['global_spent_usd']:.4f}")
        print(f"   Global available: ${status['global_available_usd']:.4f}")
        print(f"   Baseline (computed from ledger): ${status['baseline_locked_usd']:.4f}")
        print(f"   Stage cap: ${status['stage_cap_usd']:.2f}")
        print(f"   Stage spent: ${status['stage_spent_usd']:.4f}")
        print(f"   Stage reserved: ${status['stage_reserved_usd']:.4f}")
        print(f"   Stage used: ${status['stage_used_usd']:.4f}")
        print(f"   Stage available: ${status['stage_available_usd']:.4f}")
        
        if status['stage_available_usd'] < 0.01:
            print(f"\n❌ INSUFFICIENT STAGE BUDGET:")
            print(f"   Stage cap ${args.stage_cap:.2f} already exceeded")
            return 1
        
        provider_client = ProviderClient(
            budget_tracker=stage_budget,  # Use stage enforcer
            experiment="swarm",
            dry_run=False,
            journal_dir=ledger_path.parent / "journal"
        )
    
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
                    config, prompts, provider_client, run_id, trace_dir
                )
            else:
                result = run_episode_team(
                    ep["episode_id"], case, arm, ep["model_id"],
                    config, prompts, provider_client, run_id, trace_dir
                )
            
            results.append(result)
            
            if result.get("status") == "complete":
                action = result.get('final_action') or result.get('outcome', 'no_action')
                cost = result.get('total_cost_usd', 0)
                print(f"  ✓ {action} (${cost:.4f})")
            else:
                print(f"  ✗ {result.get('status')}: {result.get('error', 'unknown')}")
                
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
            "pilot": True,
            "mock": args.mock,
            "episodes_scheduled": len(schedule),
            "episodes_completed": len(results),
            "total_calls": sum(r.get("total_calls", 0) for r in results),
            "total_cost_usd": sum(r.get("total_cost_usd", 0) for r in results),
            "protocol_hashes": hashes,
            "results": results
        }, f, indent=2)
    
    completed = len([r for r in results if r.get('status') == 'complete'])
    total_cost = sum(r.get('total_cost_usd', 0) for r in results)
    total_calls = sum(r.get('total_calls', 0) for r in results)
    
    print(f"\n✅ RUN COMPLETE")
    print(f"   Results: {output_file}")
    print(f"   Traces: {trace_dir}/ ({completed} episode JSON files)")
    print(f"   Completed: {completed}/{len(schedule)} episodes")
    print(f"   Total calls: {total_calls}")
    print(f"   Total cost: ${total_cost:.4f}")
    print(f"   {'Mock' if args.mock else 'Real'} ledger: {budget.db_path}")
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
