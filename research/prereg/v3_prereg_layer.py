#!/usr/bin/env python3
"""Prereg integration layer - extends v3final harness without modifying frozen files.

This module provides:
1. Study 1 beneficiary cues with system prompt insertion
2. Study 2 car_role cells with proper no-tools handling
3. Explicit cue_seen set
4. Correct v3final API signature compatibility
"""
import copy
import json
import sys
from pathlib import Path

# Add v3final harness to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "v3final" / "harness"))

from v3 import cases as K
from v3 import run as v3run

# Capture original car_spec before run_prereg overwrites it
_ORIGINAL_CAR_SPEC = K.car_spec

# Import DEC regex from v3/run.py
import re
DEC = re.compile(r"DECISION\s*[:：]\s*\**\s*([a-z_]+)", re.I)

# System cues that should be checked in cue_seen logic
SYSTEM_CUE_SET = {"memo", "memo_soft", "memo_soft_eval", "benef_org", "benef_self", "benef_other", "benef_bridge"}

# Mapping from our cue names to prompts_study1.json arms
CUE_TO_ARM = {
    "benef_org": "org",
    "benef_self": "self",
    "benef_other": "other",
    "benef_bridge": "bridge",
    "none": "none",
}

# Study 1 and Study 2 prompts with expected SHA256 hashes
S1_PROMPTS_PATH = Path(__file__).resolve().parent.parent.parent / "research" / "v3" / "prompts_study1.json"
S1_PROMPTS_SHA256 = "522422ac87b3908ba37d28271433ae91b3e72bcda67f202278afcb80d398d9c1"

S2_PROMPTS_PATH = Path(__file__).resolve().parent.parent.parent / "research" / "v3" / "prompts_study2.json"
S2_PROMPTS_SHA256 = "2fa4403cac3ce81cfd7a52f81353959fec2c8efb7284100fe8fba9fe55b58c9f"


def make_car_spec_for_model(model):
    """Factory function that creates a car_spec function with model captured.
    
    Fix #2: Returns a car_spec compatible with v3final signature that loads
    Study 1 prompts byte-for-byte from prompts_study1.json.
    """
    def car_spec_with_model(level, para, lvl, policy="discretion", escalation=True, cue=None, arm=None):
        """car_spec that loads Study 1 prompts for this model."""
        if cue in CUE_TO_ARM:
            # Load Study 1 prompts with SHA256 verification
            prompts_data = verify_prompts_sha256(S1_PROMPTS_PATH, S1_PROMPTS_SHA256, "Study 1")
            
            # Map cue to arm name in JSON
            arm_name = CUE_TO_ARM[cue]
            
            # Navigate to specs[model][arm_name] list
            if model not in prompts_data['specs']:
                raise KeyError(f"Model '{model}' not found in Study 1 prompts")
            
            if arm_name not in prompts_data['specs'][model]:
                raise KeyError(f"Arm '{arm_name}' not found for model '{model}' in Study 1 prompts")
            
            specs_list = prompts_data['specs'][model][arm_name]
            
            # Find matching spec by level and para
            for spec in specs_list:
                if spec['level'] == lvl and spec['para'] == para:
                    # Return the prereg spec verbatim (system, user, tools)
                    return {
                        'system': spec['system'],
                        'user': spec['user'],
                        'tools': spec.get('tools', []),
                    }
            
            raise KeyError(f"No Study 1 spec found for model={model}, arm={arm_name}, level={lvl}, para={para}")
        else:
            # Use original car_spec for other cues (dashboard, crm, etc.)
            return _ORIGINAL_CAR_SPEC(level, para, lvl, policy, escalation, cue, arm)
    
    return car_spec_with_model


def verify_prompts_sha256(prompts_path, expected_sha256, study_name):
    """Verify prompts file SHA256 hash at load time."""
    import hashlib
    
    if not prompts_path.exists():
        raise FileNotFoundError(f"{study_name} prompts not found: {prompts_path}")
    
    content = prompts_path.read_bytes()
    actual_sha = hashlib.sha256(content).hexdigest()
    
    if actual_sha != expected_sha256:
        raise ValueError(
            f"{study_name} prompts SHA256 mismatch - prompts do not match preregistered specification:\n"
            f"  Expected: {expected_sha256}\n"
            f"  Actual:   {actual_sha}\n"
            f"  File: {prompts_path}"
        )
    
    return json.loads(content)


def car_role_spec(model, role, tools, para, lvl):
    """Generate Study 2 car_role specs from prompts_study2.json.
    
    Verifies SHA256 at load time to ensure byte-identical prompts.
    
    Args:
        model: Model name (e.g. "claude-haiku-5.5")
        role: "agent" or "advisor"
        tools: True for tools cells, False for no-tools cells
        para: Paraphrase index (0, 1, 2)
        lvl: Calibrated level (e.g. 4, 5 for Haiku)
    
    Returns:
        Dict with system, user, tools, tool_results, decisions
    """
    prompts_data = verify_prompts_sha256(S2_PROMPTS_PATH, S2_PROMPTS_SHA256, "Study 2")
    
    # Build cell name
    cell = f"{role}_{'tools' if tools else 'notools'}"
    
    # Navigate structure: specs[model][cell] is a list of specs
    if model not in prompts_data['specs']:
        raise KeyError(f"Model '{model}' not found in prompts")
    
    if cell not in prompts_data['specs'][model]:
        raise KeyError(f"Cell '{cell}' not found for model '{model}'")
    
    specs_list = prompts_data['specs'][model][cell]
    
    # Find matching spec by level and para
    for spec in specs_list:
        if spec['level'] == lvl and spec['para'] == para:
            return spec
    
    raise KeyError(f"No spec found for model={model}, cell={cell}, level={lvl}, para={para}")


def unit_with_car_role(engine, j):
    """Execute car_role unit with proper tools/no-tools handling.
    
    Fix #3-5: Properly wired into Engine.unit, uses j["stakes"], runs full episode,
    includes cell in key, doesn't double-emit.
    """
    import json as json_lib
    from v2 import toolcheck as TC
    
    # Fix #4: Use j["stakes"] not j["level"]
    spec = car_role_spec(engine.model, j["role"], j["tools"], j["para"], j["stakes"])
    
    # Fix #5: Include cell in key
    key_str = f"{j['phase']}_p{j['para']}_s{j['s']}_L{j['stakes']}_cell_{j['cell']}"
    
    row = {
        "key": key_str,
        "target": engine.model,
        "phase": j["phase"],
        "case": "car_role",
        "level": "do",  # Car_role is always "do" level
        "stakes": j["stakes"],
        "para": j["para"],
        "cell": j["cell"],
        "role": j["role"],
        "tools_enabled": j["tools"],
        "s": j["s"],
        "version": v3run.VERSION,
    }
    
    if j["tools"]:
        # Fix #4: Tools cell must run full v3final episode loop with TC.valid_calls
        msgs = [{"role": "user", "content": spec["user"]}]
        tool_calls, texts, thinks, cost, err, flags = [], [], [], 0.0, None, set()
        
        # Episode loop (max 8 steps)
        for step in range(1, 9):
            r = engine.ask(msgs, "car_role", key_str, spec["system"], spec["tools"])
            if not r["ok"]:
                err = r["error"][:500]
                break
            
            cost += r["cost"]
            msgs.append({"role": "assistant", "content": r["content"]})
            if r["text"]:
                texts.append(r["text"])
            if r["thinking"]:
                thinks.append(r["thinking"])
            if r.get("tool_from_text"):
                flags.add("tool_from_text")
            if r.get("truncated"):
                flags.add("truncated")
            
            if not r["tool_uses"]:
                break
            
            # Process tool calls with validation
            res = []
            schemas = {t["name"]: t.get("input_schema") for t in spec["tools"]}
            for b in r["tool_uses"]:
                if b["name"] not in schemas:
                    out, ok = {"error": f"unknown tool {b['name']}"}, False
                else:
                    probs = TC.problems(schemas[b["name"]], b["input"])
                    ok = not probs
                    out = spec["tool_results"].get(b["name"], {}) if ok else TC.error_result(b["name"], probs)
                    if not ok:
                        flags.add("invalid_tool_call")
                
                tool_calls.append({"name": b["name"], "input": b["input"], "valid": ok})
                res.append({"type": "tool_result", "tool_use_id": b["id"], "content": json_lib.dumps(out)})
            
            msgs.append({"role": "user", "content": res})
        
        # Build result
        row.update({
            "tool_calls": tool_calls,
            "final_text": "\n".join(texts),
            "thinking": "\n".join(thinks),
            "cost": cost,
            "steps": step,
            "flags": sorted(flags),
        })
        
        if err:
            row["error"] = err
            row["outcome"] = "error"
        else:
            # Fix #4: outcome from valid calls only, report no-valid-call separately
            valid_calls = [c for c in tool_calls if c["valid"]]
            if not valid_calls:
                row["outcome"] = "no_valid_call"
            else:
                row["outcome"] = K.car_outcome(valid_calls)
    else:
        # No-tools cell: single chat call, parse with DEC regex
        msgs = [{"role": "user", "content": spec["user"]}]
        r = engine.T.chat(msgs, spec["system"], None, module="car_role_notool", item_id=key_str)
        
        row.update({
            "text": r.get("text", ""),
            "thinking": r.get("thinking", ""),
            "cost": r.get("cost_usd", 0),
        })
        
        if not r["ok"]:
            row["error"] = r.get("error", "unknown")[:500]
            row["outcome"] = "error"
            row["unparsed"] = False
        else:
            # Parse decision with DEC regex (last match)
            matches = DEC.findall(r["text"])
            if matches:
                dec = matches[-1].strip().lower()
                # Map to decision
                if dec in spec["decisions"]:
                    row["decision"] = dec
                    row["outcome"] = spec["decisions"][dec]
                    row["unparsed"] = False
                else:
                    row["unparsed"] = True
                    row["outcome"] = "error"
            else:
                row["unparsed"] = True
                row["outcome"] = "error"
    
    # Fix #4: Don't call engine.emit - run_stage already emits
    return row


def make_cue_seen_checker():
    """Return a function that checks if cue was seen in system prompt."""
    def check_cue_seen(j, spec_system):
        """Check if the cue appears in the system prompt."""
        cue = j.get("cue")
        if not cue:
            return False
        if cue not in SYSTEM_CUE_SET:
            return False
        # Check if cue text appears in system prompt
        if cue in BENEF_CUES:
            cue_text = BENEF_CUES[cue].get(j.get("arm", "incentive"), "")
            return cue_text in spec_system
        elif cue in K.CUES and isinstance(K.CUES[cue], dict):
            arm = j.get("arm", "incentive")
            if arm in K.CUES[cue]:
                cue_text = K.CUES[cue][arm]
                if isinstance(cue_text, str):
                    return cue_text in spec_system
        return False
    return check_cue_seen


def patch_engine_for_car_role(engine):
    """Patch Engine.unit to route car_role cases to unit_with_car_role.
    
    Fix #3: Wires unit_with_car_role into Engine.unit for Study 2.
    """
    original_unit = engine.unit
    
    def patched_unit(j):
        if j.get("case") == "car_role":
            return unit_with_car_role(engine, j)
        else:
            return original_unit(j)
    
    engine.unit = patched_unit
