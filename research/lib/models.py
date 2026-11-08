"""Model and pricing configuration for v4 research harness."""

from dataclasses import dataclass
from enum import Enum
from typing import Dict, Optional


class Provider(str, Enum):
    """API providers."""
    ANTHROPIC = "anthropic"
    GROQ = "groq"
    OPENROUTER = "openrouter"


@dataclass
class ModelConfig:
    """Configuration for a single model."""
    
    model_id: str  # Full identifier (e.g., "anthropic/claude-haiku-5-5")
    display_name: str
    provider: Provider
    api_model_name: str  # Name used in API calls
    
    # Pricing in USD per 1M tokens
    input_price_per_1m: float
    output_price_per_1m: float
    
    # Model-specific parameters
    reasoning_effort: Optional[str] = "medium"  # For models that support it
    adaptive_thinking: bool = False
    
    # Availability
    available: bool = True
    availability_note: Optional[str] = None
    
    # Version tracking
    version_id: Optional[str] = None  # e.g., "claude-haiku-5-5-20261007"
    last_verified: Optional[str] = None  # ISO date


# Pricing from preflight document (2026-11-08)
# Groq prices NOT re-verified - using config defaults
MODELS: Dict[str, ModelConfig] = {
    "anthropic/claude-haiku-5-5": ModelConfig(
        model_id="anthropic/claude-haiku-5-5",
        display_name="Claude Haiku 5.5",
        provider=Provider.ANTHROPIC,
        api_model_name="claude-haiku-5-5",
        input_price_per_1m=100.0,  # $0.10 per 1M tokens
        output_price_per_1m=500.0,  # $0.50 per 1M tokens
        adaptive_thinking=True,
        reasoning_effort="medium",
        version_id="claude-haiku-5-5-20261007",
        last_verified="2026-11-02"
    ),
    
    "groq/openai/gpt-oss-120b": ModelConfig(
        model_id="groq/openai/gpt-oss-120b",
        display_name="GPT OSS 120B",
        provider=Provider.GROQ,
        api_model_name="openai/gpt-oss-120b",
        input_price_per_1m=150.0,  # $0.15 per 1M tokens (Groq)
        output_price_per_1m=600.0,  # $0.60 per 1M tokens
        reasoning_effort="medium",
        last_verified="2026-11-02"
    ),
    
    "groq/qwen/qwen3.6-27b": ModelConfig(
        model_id="groq/qwen/qwen3.6-27b",
        display_name="Qwen 3.6 27B",
        provider=Provider.GROQ,
        api_model_name="qwen/qwen3.6-27b",
        input_price_per_1m=600.0,  # $0.60 per 1M tokens (Groq)
        output_price_per_1m=3000.0,  # $3.00 per 1M tokens
        available=True,  # Questionable - retired for dev tier 2026-09-14 but served 2026-11-02
        availability_note="Reported retired for dev tier 2026-09-14, but served successfully 2026-11-02. Verify before execution.",
        last_verified="2026-11-02"
    ),
    
    "openrouter/google/gemini-3.8-flash": ModelConfig(
        model_id="openrouter/google/gemini-3.8-flash",
        display_name="Gemini 3.8 Flash",
        provider=Provider.OPENROUTER,
        api_model_name="google/gemini-3.8-flash-20260902",
        input_price_per_1m=825.0,  # $0.825 per 1M tokens
        output_price_per_1m=4125.0,  # $4.125 per 1M tokens
        reasoning_effort="medium",
        version_id="gemini-3.8-flash-20260902",
        last_verified="2026-11-08"
    ),
}


def estimate_cost(
    model_id: str,
    input_tokens: int,
    output_tokens: int,
    multiplier: float = 1.0
) -> float:
    """
    Estimate cost for a model call.
    
    Args:
        model_id: Model identifier
        input_tokens: Number of input tokens
        output_tokens: Number of output tokens
        multiplier: Safety multiplier (default 1.0, use 3.0 for worst-case)
    
    Returns:
        Estimated cost in USD
    """
    if model_id not in MODELS:
        raise ValueError(f"Unknown model: {model_id}")
    
    model = MODELS[model_id]
    
    input_cost = (input_tokens / 1_000_000) * model.input_price_per_1m
    output_cost = (output_tokens / 1_000_000) * model.output_price_per_1m
    
    return (input_cost + output_cost) * multiplier


def get_worst_case_estimate(model_id: str, prompt_tokens: int, max_output: int = 256) -> float:
    """
    Get worst-case cost estimate for atomic reservation.
    
    Uses 3× token multiplier as safety margin.
    """
    return estimate_cost(model_id, prompt_tokens, max_output, multiplier=3.0)


def verify_model_availability() -> Dict[str, bool]:
    """
    Verify which models are marked as available.
    
    Returns:
        Dict mapping model_id to availability status
    """
    return {
        model_id: model.available
        for model_id, model in MODELS.items()
    }


def get_model_info(model_id: str) -> ModelConfig:
    """Get configuration for a model."""
    if model_id not in MODELS:
        raise ValueError(f"Unknown model: {model_id}")
    return MODELS[model_id]
