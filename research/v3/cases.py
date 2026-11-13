"""Case generation for v3 harness - Study 1 (beneficiary) and Study 2 (role×tools)"""

import json
from pathlib import Path
from typing import Any, Dict, List, Tuple

from .constants import CALIBRATED_LEVELS, CUE_ARMS, DEFAULT_ARMS, SYSTEM_CUES, ROLE_CELLS, load_study_prompts


def car_si_case(cue: str, arm: str, para: int, level: int) -> Dict[str, Any]:
    """
    Generate a self-interest case (Study 1: beneficiary control).
    
    Args:
        cue: One of "benef_org", "benef_self", "benef_other", "benef_bridge", "none"
        arm: "incentive" or "neutral" 
        para: Paraphrase index (0-2)
        level: Difficulty level (model-specific calibrated level)
    
    Returns:
        Dict with system, user, tools, tool_results, and metadata
    """
    # Load preregistered prompts
    prompts_s1 = load_study_prompts(1)
    
    # Get cue text
    cue_texts = prompts_s1["cue_texts"]
    cue_key_map = {
        "benef_org": "org",
        "benef_self": "self",
        "benef_other": "other",
        "none": "none",
        "benef_bridge": "bridge_memo_soft_optional",
    }
    cue_text = cue_texts[cue_key_map[cue]]
    
    # Find matching spec in prompts
    # The specs are organized as: specs[model][cue_short][entry]
    # We need to find the entry matching para + level + arm (kind="do")
    # For now, we'll search through all models to find a matching entry
    specs = prompts_s1["specs"]
    
    # Try to find matching spec
    found_spec = None
    for model_name, model_specs in specs.items():
        cue_short = cue_key_map[cue]
        if cue_short not in model_specs:
            continue
        
        for spec in model_specs[cue_short]:
            if (spec.get("para") == para and 
                spec.get("level") == level and
                spec.get("kind") == "do"):
                found_spec = spec
                break
        
        if found_spec:
            break
    
    if not found_spec:
        raise ValueError(f"No spec found for cue={cue}, para={para}, level={level}")
    
    return {
        "system": found_spec["system"],
        "user": found_spec["user"],
        "tools": found_spec["tools"],
        "tool_results": found_spec["tool_results"],
        "cue": cue,
        "arm": arm,
        "para": para,
        "level": level,
    }


def car_role_spec(role: str, tools: bool, para: int, level: int) -> Dict[str, Any]:
    """
    Generate a role×tools case (Study 2: 2x2 design).
    
    Args:
        role: "agent" or "advisor"
        tools: True (tools available) or False (no tools, parse DECISION)
        para: Paraphrase index (0-2)
        level: Difficulty level (model-specific calibrated level)
    
    Returns:
        Dict with system, user, tools, tool_results, decisions, and metadata
    """
    # Load preregistered prompts
    prompts_s2 = load_study_prompts(2)
    
    # Determine cell name
    cell = f"{role}_{'tools' if tools else 'notools'}"
    
    # Find matching spec
    specs = prompts_s2["specs"]
    
    found_spec = None
    for model_name, model_specs in specs.items():
        if cell not in model_specs:
            continue
        
        for spec in model_specs[cell]:
            if spec.get("para") == para and spec.get("level") == level:
                found_spec = spec
                break
        
        if found_spec:
            break
    
    if not found_spec:
        raise ValueError(f"No spec found for cell={cell}, para={para}, level={level}")
    
    return {
        "system": found_spec["system"],
        "user": found_spec["user"],
        "tools": found_spec.get("tools"),
        "tool_results": found_spec.get("tool_results"),
        "decisions": found_spec.get("decisions"),
        "cell": cell,
        "role": role,
        "has_tools": tools,
        "para": para,
        "level": level,
    }


def get_cue_arms(cue: str) -> Tuple[str, ...]:
    """Get the arms for a given cue (single-arm cues return only incentive)"""
    return CUE_ARMS.get(cue, DEFAULT_ARMS)


def is_system_cue(cue: str) -> bool:
    """Check if cue should be inserted into system prompt"""
    return cue in SYSTEM_CUES


def lookup_account_result(level: int) -> Dict[str, Any]:
    """
    Generate the lookup_account tool result for a given difficulty level.
    This is hardcoded based on the billing scenario structure.
    """
    # Load from prompts to ensure byte-identical output
    prompts_s1 = load_study_prompts(1)
    
    # Find any spec with this level and extract its tool_results
    for model_specs in prompts_s1["specs"].values():
        for cue_specs in model_specs.values():
            for spec in cue_specs:
                if spec.get("level") == level:
                    return spec["tool_results"]["lookup_account"]
    
    raise ValueError(f"No lookup_account result found for level={level}")
