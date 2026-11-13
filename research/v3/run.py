"""Main execution harness for v3 preregistered studies"""

import argparse
import json
import os
import sys
from collections import Counter
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from .cases import car_si_case, car_role_spec, get_cue_arms
from .constants import CALIBRATED_LEVELS, MODEL_CONFIGS, ROLE_CELLS


class MockClient:
    """Mock API client for offline testing"""
    
    def __init__(self, model: str):
        self.model = model
    
    def chat(self, messages: List[Dict], tools: Optional[List[Dict]] = None, 
             tool_choice: Optional[str] = None) -> Dict[str, Any]:
        """Mock chat completion"""
        return {
            "choices": [{
                "message": {
                    "role": "assistant",
                    "content": "DECISION: waive_fee" if tools is None else None,
                    "tool_calls": [{
                        "id": "mock_call_1",
                        "function": {
                            "name": "lookup_account",
                            "arguments": json.dumps({"account_id": "LK-20931"})
                        }
                    }] if tools else None,
                }
            }],
            "usage": {
                "prompt_tokens": 500,
                "completion_tokens": 100,
            }
        }


def plan(iter_name: str, stage: str, phases: List[str], cues: Optional[List[str]] = None,
         cue_n: Optional[Dict[str, int]] = None, role_n: Optional[int] = None,
         models: Optional[List[str]] = None, reuse_calibration: Optional[str] = None) -> List[Dict]:
    """
    Plan experimental units for the run.
    
    Args:
        iter_name: Iteration name (e.g., "s1-benef", "s2-role")
        stage: "canary" or "main"
        phases: List of phases to run ("si" for Study 1, "role" for Study 2)
        cues: List of cues for SI phase (e.g., ["benef_org", "benef_self", "benef_other", "none"])
        cue_n: Per-cue sample size (e.g., {"benef_org": 24, ...})
        role_n: Per-level sample size for role phase (default 24 for main, 8 for canary)
        models: List of models (default: all 4 preregistered models)
        reuse_calibration: If "v3final", validate levels match preregistered ones
    
    Returns:
        List of unit dicts with keys: phase, model, cue/cell, arm, para, level, key
    """
    if models is None:
        models = list(CALIBRATED_LEVELS.keys())
    
    # Validate calibration reuse
    if reuse_calibration == "v3final":
        for model in models:
            expected_levels = CALIBRATED_LEVELS.get(model)
            if expected_levels is None:
                raise ValueError(f"Model {model} not in preregistered calibration")
    
    units = []
    
    # SI phase (Study 1)
    if "si" in phases:
        if not cues:
            raise ValueError("SI phase requires --cues")
        if not cue_n:
            raise ValueError("SI phase requires --cue-n")
        
        for cue in cues:
            arms = get_cue_arms(cue)
            n_per_cue = cue_n[cue]
            
            for model in models:
                levels = CALIBRATED_LEVELS[model]
                
                # Distribute n across levels and paraphrases
                # Strategy: balance across levels × paraphrases
                # For n=24: 2 levels × 3 paraphrases × 2 = 12, so n=24 gives 2 per cell
                # For n=8: same cells, but less replication
                
                n_levels = len(levels)
                n_paras = 3  # Fixed: para in {0, 1, 2}
                cells_per_arm = n_levels * n_paras
                
                for arm in arms:
                    replications = n_per_cue // cells_per_arm
                    remainder = n_per_cue % cells_per_arm
                    
                    cell_idx = 0
                    for level in levels:
                        for para in range(n_paras):
                            n_this_cell = replications + (1 if cell_idx < remainder else 0)
                            
                            for rep in range(n_this_cell):
                                key = f"{model}_{cue}_{arm}_p{para}_l{level}_r{rep}"
                                units.append({
                                    "phase": "si",
                                    "model": model,
                                    "cue": cue,
                                    "arm": arm,
                                    "para": para,
                                    "level": level,
                                    "rep": rep,
                                    "key": key,
                                })
                            
                            cell_idx += 1
    
    # Role phase (Study 2)
    if "role" in phases:
        if role_n is None:
            role_n = 8 if stage == "canary" else 24
        
        for model in models:
            levels = CALIBRATED_LEVELS[model]
            
            for cell in ROLE_CELLS:
                # Parse cell into role and tools
                if cell.startswith("agent_"):
                    role = "agent"
                    tools = cell == "agent_tools"
                elif cell.startswith("advisor_"):
                    role = "advisor"
                    tools = cell == "advisor_tools"
                else:
                    raise ValueError(f"Unknown cell: {cell}")
                
                # Distribute role_n across levels and paraphrases
                n_levels = len(levels)
                n_paras = 3
                cells_count = n_levels * n_paras
                
                replications = role_n // cells_count
                remainder = role_n % cells_count
                
                cell_idx = 0
                for level in levels:
                    for para in range(n_paras):
                        n_this_cell = replications + (1 if cell_idx < remainder else 0)
                        
                        for rep in range(n_this_cell):
                            key = f"{model}_{cell}_p{para}_l{level}_r{rep}"
                            units.append({
                                "phase": "role",
                                "model": model,
                                "cell": cell,
                                "role": role,
                                "tools": tools,
                                "para": para,
                                "level": level,
                                "rep": rep,
                                "key": key,
                            })
                        
                        cell_idx += 1
    
    return units


def execute_unit(unit: Dict, client: Any, output_path: Path, dry_run: bool = False) -> Optional[Dict]:
    """
    Execute one experimental unit.
    
    Args:
        unit: Unit dict from plan()
        client: API client (or MockClient)
        output_path: Path to calls.jsonl
        dry_run: If True, count calls but don't execute
    
    Returns:
        Result dict with outcome, cost, etc., or None if dry_run
    """
    if dry_run:
        # For dry-run, estimate token counts
        if unit["phase"] == "si":
            # SI: ~2-3 calls (lookup, maybe waive, send_reply)
            estimated_calls = 2.5
        else:
            # Role: tools=1.5 calls avg, notools=1 call
            estimated_calls = 1.5 if unit.get("tools") else 1.0
        
        return {"estimated_calls": estimated_calls}
    
    # Generate case
    if unit["phase"] == "si":
        case = car_si_case(unit["cue"], unit["arm"], unit["para"], unit["level"])
    else:
        case = car_role_spec(unit["role"], unit["tools"], unit["para"], unit["level"])
    
    # Execute
    if unit["phase"] == "si":
        # SI phase: multi-turn episode with tools
        result = execute_si_episode(unit, case, client)
    else:
        # Role phase
        if unit["tools"]:
            result = execute_role_tools_episode(unit, case, client)
        else:
            result = execute_role_notools(unit, case, client)
    
    # Write to calls.jsonl
    with open(output_path, "a") as f:
        f.write(json.dumps({
            "unit": unit,
            "case": case,
            "result": result,
            "timestamp": datetime.utcnow().isoformat(),
        }) + "\n")
    
    return result


def execute_si_episode(unit: Dict, case: Dict, client: Any) -> Dict:
    """Execute SI episode with tools (multi-turn)"""
    messages = [
        {"role": "system", "content": case["system"]},
        {"role": "user", "content": case["user"]},
    ]
    
    # Multi-turn loop (up to 10 turns)
    tool_calls_made = []
    final_content = None
    
    for turn in range(10):
        response = client.chat(messages, tools=case["tools"], tool_choice="auto")
        msg = response["choices"][0]["message"]
        
        if msg.get("tool_calls"):
            # Handle tool calls
            for tc in msg["tool_calls"]:
                func_name = tc["function"]["name"]
                func_args = json.loads(tc["function"]["arguments"])
                tool_calls_made.append({"name": func_name, "arguments": func_args})
                
                # Add assistant message
                messages.append(msg)
                
                # Add tool result
                if func_name in case["tool_results"]:
                    result = case["tool_results"][func_name]
                else:
                    result = {"error": "Unknown tool"}
                
                messages.append({
                    "role": "tool",
                    "tool_call_id": tc["id"],
                    "content": json.dumps(result),
                })
        else:
            # Final message
            final_content = msg.get("content", "")
            break
    
    # Determine outcome
    outcome = determine_outcome(tool_calls_made)
    
    return {
        "outcome": outcome,
        "tool_calls": tool_calls_made,
        "final_content": final_content,
    }


def execute_role_tools_episode(unit: Dict, case: Dict, client: Any) -> Dict:
    """Execute role phase with tools"""
    # Similar to SI episode
    return execute_si_episode(unit, case, client)


def execute_role_notools(unit: Dict, case: Dict, client: Any) -> Dict:
    """Execute role phase without tools (parse DECISION)"""
    messages = [
        {"role": "system", "content": case["system"]},
        {"role": "user", "content": case["user"]},
    ]
    
    response = client.chat(messages, tools=None)
    content = response["choices"][0]["message"]["content"]
    
    # Parse DECISION with regex (last line wins, case-insensitive, tolerate bold)
    import re
    
    # Pattern: DECISION: waive_fee|keep_fee (case-insensitive, with optional ** for bold)
    lines = content.strip().split("\n")
    decision = None
    
    for line in reversed(lines):
        # Remove bold markers
        line_clean = line.replace("**", "").strip()
        match = re.search(r"DECISION:\s*(waive_fee|keep_fee)", line_clean, re.IGNORECASE)
        if match:
            decision = match.group(1).lower()
            break
    
    unparsed = decision is None
    outcome = "waive" if decision == "waive_fee" else ("keep" if decision == "keep_fee" else "unparsed")
    
    return {
        "outcome": outcome,
        "decision": decision,
        "unparsed": unparsed,
        "content": content,
    }


def determine_outcome(tool_calls: List[Dict]) -> str:
    """Determine outcome from tool calls"""
    # Check if waive_fee was called
    for tc in tool_calls:
        if tc["name"] == "waive_fee":
            return "waive"
    return "keep"


def dry_run_summary(units: List[Dict], models: List[str]) -> Dict:
    """
    Generate dry-run cost summary.
    
    Returns:
        Dict with total calls, cost estimates per arm/cell, and projected totals
    """
    # Count units per arm/cell
    counts = Counter()
    call_estimates = {}
    
    for unit in units:
        if unit["phase"] == "si":
            key = f"{unit['cue']}_{unit['arm']}"
        else:
            key = unit["cell"]
        counts[key] += 1
    
    # Estimate calls and costs
    # SI: 2.5 calls avg (lookup + conditional waive + send_reply)
    # Role tools: 1.5 calls avg
    # Role notools: 1 call
    
    total_calls = 0
    total_cost = 0.0
    arm_costs = {}
    
    for key, count in counts.items():
        if "_" in key and key.split("_")[0] in ["benef", "none"]:
            # SI arm
            calls_per_unit = 2.5
        elif "notools" in key:
            calls_per_unit = 1.0
        else:
            calls_per_unit = 1.5
        
        arm_calls = count * calls_per_unit
        total_calls += arm_calls
        
        # Estimate cost (use average model cost)
        avg_input_cost = sum(MODEL_CONFIGS[m]["input_price_per_1m"] for m in models) / len(models)
        avg_output_cost = sum(MODEL_CONFIGS[m]["output_price_per_1m"] for m in models) / len(models)
        
        # Rough estimate: 500 input tokens, 100 output tokens per call
        call_cost = (500 * avg_input_cost + 100 * avg_output_cost) / 1_000_000
        arm_cost = arm_calls * call_cost
        
        arm_costs[key] = {"count": count, "calls": arm_calls, "cost_usd": arm_cost}
        total_cost += arm_cost
    
    return {
        "total_units": len(units),
        "total_calls_estimated": total_calls,
        "total_cost_usd": total_cost,
        "breakdown": arm_costs,
    }


def main():
    parser = argparse.ArgumentParser(description="V3 harness for preregistered studies")
    parser.add_argument("--iter", required=True, help="Iteration name")
    parser.add_argument("--stage", required=True, choices=["canary", "main"])
    parser.add_argument("--phases", required=True, help="Comma-separated phases (si,role)")
    parser.add_argument("--preset", default="full", help="Preset (full, etc.)")
    parser.add_argument("--cues", help="Comma-separated cues for SI phase")
    parser.add_argument("--cue-n", help="Comma-separated cue:n pairs (e.g., benef_org:24,none:24)")
    parser.add_argument("--role-n", type=int, help="Sample size per level for role phase")
    parser.add_argument("--reuse-calibration", help="Reuse calibration from version (e.g., v3final)")
    parser.add_argument("--dry-run", action="store_true", help="Dry-run mode: count calls and estimate cost")
    parser.add_argument("--output-dir", type=Path, default=Path("output"), help="Output directory")
    parser.add_argument("--models", help="Comma-separated models (default: all 4)")
    
    args = parser.parse_args()
    
    # Parse arguments
    phases = args.phases.split(",")
    cues = args.cues.split(",") if args.cues else None
    models = args.models.split(",") if args.models else None
    
    # Parse cue_n
    cue_n = None
    if args.cue_n:
        cue_n = {}
        for pair in args.cue_n.split(","):
            cue, n = pair.split(":")
            cue_n[cue] = int(n)
    
    # Plan units
    units = plan(
        iter_name=args.iter,
        stage=args.stage,
        phases=phases,
        cues=cues,
        cue_n=cue_n,
        role_n=args.role_n,
        models=models,
        reuse_calibration=args.reuse_calibration,
    )
    
    print(f"Planned {len(units)} units for iter={args.iter}, stage={args.stage}")
    
    # Dry-run mode
    if args.dry_run:
        summary = dry_run_summary(units, models or list(CALIBRATED_LEVELS.keys()))
        print("\n=== DRY-RUN SUMMARY ===")
        print(f"Total units: {summary['total_units']}")
        print(f"Estimated total calls: {summary['total_calls_estimated']:.1f}")
        print(f"Projected cost: ${summary['total_cost_usd']:.2f}")
        print("\nBreakdown by arm/cell:")
        for key, data in summary["breakdown"].items():
            print(f"  {key}: {data['count']} units, {data['calls']:.1f} calls, ${data['cost_usd']:.2f}")
        return
    
    # Real execution
    output_path = args.output_dir / args.iter / "calls.jsonl"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Use mock client for now (no real API calls)
    client = MockClient("test")
    
    for i, unit in enumerate(units):
        if i % 10 == 0:
            print(f"Progress: {i}/{len(units)}")
        execute_unit(unit, client, output_path)
    
    print(f"Completed {len(units)} units, output written to {output_path}")


if __name__ == "__main__":
    main()
