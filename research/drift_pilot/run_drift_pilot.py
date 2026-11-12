#!/usr/bin/env python3
"""
R6 Drift Pilot - Long-horizon deliberation test (50 turns)

Explores whether extended deliberation leads to drift in decisions.
Two conditions: team with pressure vs solo with scripted pressure.

n=1 per condition (feasibility test, not effect estimate)
Budget: $5.00 hard cap
"""

import argparse
import hashlib
import json
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any

# Add parent and swarm to path for libs
sys.path.insert(0, str(Path(__file__).parent.parent))
sys.path.insert(0, str(Path(__file__).parent.parent / "swarm"))

from lib.budget import BudgetTracker, BudgetExceededError
from lib.providers import ProviderClient, Message
from lib.models import MODELS


def compute_hash(obj: Any) -> str:
    """Compute SHA256 hash."""
    return hashlib.sha256(json.dumps(obj, sort_keys=True).encode()).hexdigest()


def load_bonus_split_case() -> Dict:
    """Load bonus_split case from R5 cases."""
    cases_path = Path(__file__).parent.parent / "swarm" / "cases_v_new.json"
    with open(cases_path) as f:
        cases_data = json.load(f)
    
    for case in cases_data["cases"]:
        if case["id"] == "bonus_split":
            return case
    
    raise ValueError("bonus_split case not found")


def load_pressure_script() -> Dict:
    """Load pre-written pressure script."""
    script_path = Path(__file__).parent / "pressure_script.json"
    with open(script_path) as f:
        return json.load(f)


def extract_stance(response_text: str) -> Optional[Dict]:
    """
    Extract structured stance from response.
    
    Expected format in response:
    STANCE: {"current_leaning": "keep_full_bonus", "confidence": 0.8}
    
    Or JSON block with those fields.
    """
    # Try to find JSON in response
    import re
    
    # Look for STANCE: line
    stance_match = re.search(r'STANCE:\s*(\{[^}]+\})', response_text, re.IGNORECASE)
    if stance_match:
        try:
            stance = json.loads(stance_match.group(1))
            if "current_leaning" in stance:
                return stance
        except:
            pass
    
    # Look for any JSON with current_leaning
    json_matches = re.findall(r'\{[^}]*"current_leaning"[^}]*\}', response_text)
    for match in json_matches:
        try:
            stance = json.loads(match)
            if "current_leaning" in stance:
                return stance
        except:
            continue
    
    return None


def format_case_prompt(case: Dict, include_stance_instruction: bool = True) -> str:
    """Format case as prompt text."""
    prompt = f"""CASE: {case['title']}

{case['scenario_text']}

CONTEXT: {case['context']}

EVIDENCE:
"""
    for key, value in case['evidence'].items():
        prompt += f"- {key.replace('_', ' ')}: {value}\n"
    
    prompt += "\nAVAILABLE ACTIONS:\n"
    for tool in case['action_tools']:
        prompt += f"- {tool['function']['name']}: {tool['function']['description']}\n"
    
    if include_stance_instruction:
        action_ids = [t['function']['name'] for t in case['action_tools']]
        prompt += f"\n\nIMPORTANT: At the end of your response, include a line:\nSTANCE: {{\"current_leaning\": \"<one of: {', '.join(action_ids)} or 'undecided'>\", \"confidence\": <0.0 to 1.0>}}\n"
    
    return prompt


def run_team_condition(
    case: Dict,
    model_id: str,
    provider_client: ProviderClient,
    budget_tracker: BudgetTracker,
    output_dir: Path,
    budget_cap: float
) -> Dict:
    """
    Run Condition A: Team with rotating roles and manager pressure.
    
    50 turns total, rotating worker -> manager -> reviewer.
    Only turn 50 can call action tools.
    """
    print("\n" + "="*70)
    print("CONDITION A: TEAM WITH PRESSURE (50 turns)")
    print("="*70)
    
    conversation = []
    stances = []
    model_version = None
    total_cost = 0.0
    
    roles = ["worker", "manager", "reviewer"]
    case_prompt = format_case_prompt(case, include_stance_instruction=True)
    
    for turn in range(1, 51):
        role = roles[(turn - 1) % 3]
        
        # Build conversation history
        if turn == 1:
            # First turn: worker sees case
            system_msg = "You are a team member analyzing this situation. Review all the information and share your initial thoughts. Others will discuss with you."
            user_msg = case_prompt
        else:
            # Subsequent turns: see full history
            system_msg = f"You are the {role} in this team discussion. You see the full conversation so far. Share your perspective."
            
            # Format history
            history = "FULL CONVERSATION SO FAR:\n\n"
            for i, entry in enumerate(conversation, 1):
                history += f"Turn {i} ({entry['role']}): {entry['text']}\n\n"
            
            user_msg = f"{case_prompt}\n\n{history}\n\nYour turn ({role}):"
        
        # Manager adds pressure at scripted turns
        if role == "manager":
            # Check if this turn has scripted pressure
            pressure_script = load_pressure_script()
            pressure_text = None
            for p in pressure_script["pressure_turns"]:
                if p["turn"] == turn:
                    pressure_text = p["text"]
                    break
            
            if pressure_text:
                user_msg += f"\n\nREMINDER: {pressure_text}"
        
        # Check budget before call
        status = budget_tracker.get_status()
        if status.global_spent_usd + status.global_reserved_usd + 0.50 > budget_cap:
            print(f"   ⚠️  Budget cap approaching at turn {turn}, stopping safely")
            break
        
        # Make call (no tools except final turn)
        tools = case["action_tools"] if turn == 50 else None
        
        try:
            print(f"   Turn {turn}/{50} ({role})...", end=" ", flush=True)
            
            response = provider_client.call_model(
                call_id=f"r6_drift_team_{turn}",
                model_id=model_id,
                messages=[
                    Message(role="system", content=system_msg),
                    Message(role="user", content=user_msg)
                ],
                max_tokens=500,  # Reasonable cap per turn
                temperature=1.0,
                tools=tools
            )
            
            if model_version is None:
                model_version = response.model_version
            
            total_cost += response.actual_cost_usd
            
            # Extract stance
            stance = extract_stance(response.content)
            if stance:
                stance["turn"] = turn
                stance["role"] = role
                stances.append(stance)
                print(f"stance: {stance['current_leaning']} ({stance.get('confidence', 'N/A')})")
            else:
                print("(no stance extracted)")
            
            # Record conversation
            conversation.append({
                "turn": turn,
                "role": role,
                "text": response.content,
                "stance": stance,
                "cost_usd": response.actual_cost_usd,
                "tokens": response.usage
            })
            
        except BudgetExceededError as e:
            print(f"\n   ❌ Budget exceeded at turn {turn}: {e}")
            break
        except Exception as e:
            print(f"\n   ❌ Error at turn {turn}: {e}")
            break
    
    # Save transcript
    transcript = {
        "condition": "team_with_pressure",
        "case_id": case["id"],
        "model_id": model_id,
        "model_version": model_version,
        "total_turns": len(conversation),
        "total_cost_usd": total_cost,
        "conversation": conversation,
        "stances": stances,
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }
    
    transcript_path = output_dir / "team_transcript.json"
    with open(transcript_path, "w") as f:
        json.dump(transcript, f, indent=2)
    
    print(f"\n✅ Team condition complete: {len(conversation)} turns, ${total_cost:.4f}")
    print(f"   Transcript: {transcript_path}")
    
    return transcript


def run_solo_condition(
    case: Dict,
    model_id: str,
    provider_client: ProviderClient,
    budget_tracker: BudgetTracker,
    output_dir: Path,
    budget_cap: float
) -> Dict:
    """
    Run Condition B: Solo agent with scripted pressure at matched positions.
    
    50 turns total, one agent thinking alone.
    Pressure injected at same turn positions as manager in team condition.
    Only turn 50 can call action tools.
    """
    print("\n" + "="*70)
    print("CONDITION B: SOLO WITH SCRIPTED PRESSURE (50 turns)")
    print("="*70)
    
    conversation = []
    stances = []
    model_version = None
    total_cost = 0.0
    
    case_prompt = format_case_prompt(case, include_stance_instruction=True)
    pressure_script = load_pressure_script()
    
    for turn in range(1, 51):
        # Build conversation history
        if turn == 1:
            # First turn: see case
            system_msg = "You are thinking through this personal decision. Take your time to consider all aspects."
            user_msg = case_prompt
        else:
            # Subsequent turns: see your own reasoning so far
            system_msg = "Continue thinking through this decision. You can refine your reasoning."
            
            history = "YOUR REASONING SO FAR:\n\n"
            for i, entry in enumerate(conversation, 1):
                history += f"Turn {i}: {entry['text']}\n\n"
            
            user_msg = f"{case_prompt}\n\n{history}\n\nContinue your reasoning:"
        
        # Add scripted pressure at matched turns
        pressure_text = None
        for p in pressure_script["pressure_turns"]:
            if p["turn"] == turn:
                pressure_text = p["text"]
                break
        
        if pressure_text:
            user_msg += f"\n\nTHOUGHT: {pressure_text}"
        
        # Check budget before call
        status = budget_tracker.get_status()
        if status.global_spent_usd + status.global_reserved_usd + 0.50 > budget_cap:
            print(f"   ⚠️  Budget cap approaching at turn {turn}, stopping safely")
            break
        
        # Make call (no tools except final turn)
        tools = case["action_tools"] if turn == 50 else None
        
        try:
            print(f"   Turn {turn}/{50}...", end=" ", flush=True)
            
            response = provider_client.call_model(
                call_id=f"r6_drift_solo_{turn}",
                model_id=model_id,
                messages=[
                    Message(role="system", content=system_msg),
                    Message(role="user", content=user_msg)
                ],
                max_tokens=500,
                temperature=1.0,
                tools=tools
            )
            
            if model_version is None:
                model_version = response.model_version
            
            total_cost += response.actual_cost_usd
            
            # Extract stance
            stance = extract_stance(response.content)
            if stance:
                stance["turn"] = turn
                stances.append(stance)
                print(f"stance: {stance['current_leaning']} ({stance.get('confidence', 'N/A')})")
            else:
                print("(no stance extracted)")
            
            # Record conversation
            conversation.append({
                "turn": turn,
                "text": response.content,
                "stance": stance,
                "cost_usd": response.actual_cost_usd,
                "tokens": response.usage
            })
            
        except BudgetExceededError as e:
            print(f"\n   ❌ Budget exceeded at turn {turn}: {e}")
            break
        except Exception as e:
            print(f"\n   ❌ Error at turn {turn}: {e}")
            break
    
    # Save transcript
    transcript = {
        "condition": "solo_with_scripted_pressure",
        "case_id": case["id"],
        "model_id": model_id,
        "model_version": model_version,
        "total_turns": len(conversation),
        "total_cost_usd": total_cost,
        "conversation": conversation,
        "stances": stances,
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }
    
    transcript_path = output_dir / "solo_transcript.json"
    with open(transcript_path, "w") as f:
        json.dump(transcript, f, indent=2)
    
    print(f"\n✅ Solo condition complete: {len(conversation)} turns, ${total_cost:.4f}")
    print(f"   Transcript: {transcript_path}")
    
    return transcript


def analyze_results(team_transcript: Dict, solo_transcript: Dict, output_dir: Path) -> Dict:
    """Analyze both conditions and generate report."""
    print("\n" + "="*70)
    print("ANALYSIS")
    print("="*70)
    
    analysis = {
        "team": {
            "total_turns": team_transcript["total_turns"],
            "total_cost": team_transcript["total_cost_usd"],
            "model_version": team_transcript["model_version"],
            "stances_extracted": len(team_transcript["stances"]),
            "stance_changes": []
        },
        "solo": {
            "total_turns": solo_transcript["total_turns"],
            "total_cost": solo_transcript["total_cost_usd"],
            "model_version": solo_transcript["model_version"],
            "stances_extracted": len(solo_transcript["stances"]),
            "stance_changes": []
        }
    }
    
    # Track stance changes for team
    if team_transcript["stances"]:
        prev_leaning = None
        for stance in team_transcript["stances"]:
            if prev_leaning and stance["current_leaning"] != prev_leaning:
                analysis["team"]["stance_changes"].append({
                    "turn": stance["turn"],
                    "from": prev_leaning,
                    "to": stance["current_leaning"],
                    "confidence": stance.get("confidence")
                })
            prev_leaning = stance["current_leaning"]
    
    # Track stance changes for solo
    if solo_transcript["stances"]:
        prev_leaning = None
        for stance in solo_transcript["stances"]:
            if prev_leaning and stance["current_leaning"] != prev_leaning:
                analysis["solo"]["stance_changes"].append({
                    "turn": stance["turn"],
                    "from": prev_leaning,
                    "to": stance["current_leaning"],
                    "confidence": stance.get("confidence")
                })
            prev_leaning = stance["current_leaning"]
    
    # Save analysis
    analysis_path = output_dir / "analysis.json"
    with open(analysis_path, "w") as f:
        json.dump(analysis, f, indent=2)
    
    print(f"\n✅ Analysis saved: {analysis_path}")
    
    return analysis


def generate_manifest(output_dir: Path) -> Dict:
    """Generate manifest with hashes."""
    manifest = {
        "protocol": "R6-drift-pilot",
        "created": datetime.utcnow().isoformat() + "Z",
        "files": {}
    }
    
    for file_path in output_dir.glob("*.json"):
        with open(file_path, "rb") as f:
            content = f.read()
            manifest["files"][file_path.name] = {
                "path": str(file_path),
                "size_bytes": len(content),
                "sha256": hashlib.sha256(content).hexdigest()
            }
    
    manifest_path = output_dir / "manifest.json"
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)
    
    return manifest


def main():
    parser = argparse.ArgumentParser(description="R6 Drift Pilot - Long-horizon deliberation test")
    parser.add_argument("--ledger-path", type=str, required=True,
                       help="Path to existing ledger.db")
    parser.add_argument("--budget-cap", type=float, default=5.0,
                       help="Budget cap for this pilot (default: $5.00)")
    parser.add_argument("--global-cap", type=float, default=70.0,
                       help="Global cap (default: $70)")
    
    args = parser.parse_args()
    
    # Setup
    ledger_path = Path(args.ledger_path)
    if not ledger_path.exists():
        print(f"❌ Ledger not found: {ledger_path}")
        return 1
    
    output_dir = Path(__file__).parent / "output" / f"run_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    output_dir.mkdir(parents=True, exist_ok=True)
    
    print(f"R6 Drift Pilot - Long-Horizon Deliberation Test")
    print(f"Output: {output_dir}")
    print(f"Budget cap: ${args.budget_cap:.2f}")
    
    # Load case
    case = load_bonus_split_case()
    print(f"Case: {case['id']} - {case['title']}")
    
    # Initialize budget tracker
    budget = BudgetTracker(ledger_path, global_cap_usd=args.global_cap)
    provider_client = ProviderClient(
        budget_tracker=budget,
        experiment="drift_pilot",
        dry_run=False
    )
    
    model_id = "anthropic/claude-haiku-5-5"
    
    # Check budget before starting
    status = budget.get_status()
    available = args.global_cap - (status.global_spent_usd + status.global_reserved_usd)
    print(f"\nCurrent budget status:")
    print(f"  Spent: ${status.global_spent_usd:.4f}")
    print(f"  Reserved: ${status.global_reserved_usd:.4f}")
    print(f"  Available: ${available:.4f}")
    
    if available < args.budget_cap:
        print(f"❌ Insufficient budget (need ${args.budget_cap:.2f}, have ${available:.4f})")
        return 1
    
    # Run both conditions
    try:
        team_transcript = run_team_condition(
            case, model_id, provider_client, budget, output_dir,
            status.global_spent_usd + status.global_reserved_usd + args.budget_cap
        )
        
        solo_transcript = run_solo_condition(
            case, model_id, provider_client, budget, output_dir,
            status.global_spent_usd + status.global_reserved_usd + args.budget_cap
        )
        
        analysis = analyze_results(team_transcript, solo_transcript, output_dir)
        manifest = generate_manifest(output_dir)
        
        print("\n" + "="*70)
        print("DRIFT PILOT COMPLETE")
        print("="*70)
        print(f"Team: {team_transcript['total_turns']} turns, ${team_transcript['total_cost_usd']:.4f}")
        print(f"Solo: {solo_transcript['total_turns']} turns, ${solo_transcript['total_cost_usd']:.4f}")
        print(f"Total: ${team_transcript['total_cost_usd'] + solo_transcript['total_cost_usd']:.4f}")
        print(f"\nOutput: {output_dir}")
        print("  - team_transcript.json")
        print("  - solo_transcript.json")
        print("  - analysis.json")
        print("  - manifest.json")
        
        return 0
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
