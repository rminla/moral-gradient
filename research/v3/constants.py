"""Constants and configuration for v3 harness"""

import json
from pathlib import Path
from typing import Dict, List, Tuple

# Model pricing per 1M tokens (verified rates)
MODEL_CONFIGS = {
    "claude-haiku-5.5": {
        "provider": "anthropic",
        "api_model_name": "claude-haiku-5-5",
        "env_var": "ANTHROPIC_API_KEY",
        "input_price_per_1m": 0.10,
        "output_price_per_1m": 0.50,
    },
    "gpt-oss-120b": {
        "provider": "openai",
        "api_model_name": "gpt-oss-120b",
        "env_var": "GROQ_API_KEY",
        "input_price_per_1m": 0.15,
        "output_price_per_1m": 0.60,
        "base_url": "https://api.groq.com/openai/v1",
    },
    "qwen3.6-27b": {
        "provider": "openai",
        "api_model_name": "qwen3.6-27b",
        "env_var": "GROQ_API_KEY",
        "input_price_per_1m": 0.60,
        "output_price_per_1m": 3.00,
        "base_url": "https://api.groq.com/openai/v1",
    },
    "gemini-3.8-flash": {
        "provider": "openai",
        "api_model_name": "google/gemini-3.8-flash-20260902",
        "env_var": "OPENROUTER_API_KEY",
        "input_price_per_1m": 0.825,
        "output_price_per_1m": 4.125,
        "base_url": "https://openrouter.ai/api/v1",
    },
}

# Preregistered calibration levels (from v3final)
CALIBRATED_LEVELS = {
    "claude-haiku-5.5": [4, 5],
    "gpt-oss-120b": [1, 2],
    "qwen3.6-27b": [2, 3],
    "gemini-3.8-flash": [2, 3],
}

# Study 1: Cue arms configuration
CUE_ARMS = {
    "benef_org": ("incentive",),
    "benef_self": ("incentive",),
    "benef_other": ("incentive",),
    "benef_bridge": ("incentive",),  # Optional BRIDGE arm
    "none": ("neutral",),
}

# Default arms for any cue not in CUE_ARMS
DEFAULT_ARMS = ("neutral", "incentive")

# Cues that should insert into system prompt (like memo* cues)
SYSTEM_CUES = {"benef_org", "benef_self", "benef_other", "benef_bridge", "memo_soft"}

# Study 2: Role×Tools cells
ROLE_CELLS = ["agent_tools", "agent_notools", "advisor_tools", "advisor_notools"]

# Qwen keep-fee definition: 31 characters (corrected from analyze.py:28 / traces.py:28)
# "keeps the fee (outcome: `keep`)"
QWEN_KEEP_DEFINITION = "keeps the fee (outcome: `keep`)"
assert len(QWEN_KEEP_DEFINITION) == 31, f"Qwen keep definition must be exactly 31 chars, got {len(QWEN_KEEP_DEFINITION)}"

# Load preregistered prompts
def load_study_prompts(study: int) -> Dict:
    """Load prompts_study1.json or prompts_study2.json"""
    path = Path(__file__).parent / f"prompts_study{study}.json"
    with open(path) as f:
        return json.load(f)
