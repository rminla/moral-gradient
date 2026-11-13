"""car_role_spec for Study 2 (role × tools 2x2): generates specs from prompts_study2.json"""
import json
from pathlib import Path

# Lazy-load preregistered Study 2 prompts (don't fail if file doesn't exist at import time)
_PROMPTS_S2 = None

def _load_prompts():
    global _PROMPTS_S2
    if _PROMPTS_S2 is None:
        _s2_path = Path(__file__).resolve().parent.parent.parent / "v3" / "prompts_study2.json"
        with open(_s2_path) as f:
            _PROMPTS_S2 = json.load(f)
    return _PROMPTS_S2

def car_role_spec(role, tools, para, lvl, model=None):
    """
    Generate a role×tools case for Study 2.
    
    Args:
        role: "agent" or "advisor"
        tools: True (tools available) or False (no tools, parse DECISION)
        para: Paraphrase index (0-2)
        lvl: Difficulty level (model-specific calibrated level)
        model: Model name (optional, for finding the right spec)
    
    Returns:
        Dict with system, user, tools, tool_results, decisions
    """
    prompts_s2 = _load_prompts()
    cell = f"{role}_{'tools' if tools else 'notools'}"
    
    # Find matching spec in the preregistered prompts
    # If model is provided, use that; otherwise search all models
    models_to_search = [model] if model else list(prompts_s2["specs"].keys())
    
    for m in models_to_search:
        if m not in prompts_s2["specs"]:
            continue
        if cell not in prompts_s2["specs"][m]:
            continue
        
        for spec in prompts_s2["specs"][m][cell]:
            if spec.get("para") == para and spec.get("level") == lvl:
                return {
                    "kind": "do",
                    "case": "car_role",
                    "cell": cell,
                    "role": role,
                    "has_tools": tools,
                    "system": spec["system"],
                    "user": spec["user"],
                    "tools": spec.get("tools"),
                    "tool_results": spec.get("tool_results"),
                    "decisions": spec.get("decisions"),
                    "para": para,
                    "level": lvl,
                }
    
    raise ValueError(f"No spec found for cell={cell}, para={para}, level={lvl}, model={model}")
