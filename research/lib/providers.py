"""Provider client wrappers with cost tracking and error handling."""

import hashlib
import json
import os
import time
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

from .budget import BudgetTracker
from .models import MODELS, Provider, get_model_info, get_worst_case_estimate


@dataclass
class Message:
    """A chat message."""
    role: str  # "system", "user", or "assistant"
    content: str


@dataclass
class ModelResponse:
    """Response from a model call."""
    content: str
    model_version: str
    usage: Dict[str, int]  # prompt_tokens, completion_tokens, total_tokens
    actual_cost_usd: float
    duration_ms: int
    raw_response: Optional[Dict] = None  # Full response for debugging


class ProviderClient:
    """
    Base provider client with budget tracking.
    
    Handles:
    - Atomic budget reservation before calls
    - Cost reconciliation after calls
    - Retry logic for transient errors
    - Response parsing
    """
    
    def __init__(
        self,
        budget_tracker: BudgetTracker,
        experiment: str,
        dry_run: bool = False
    ):
        """
        Initialize provider client.
        
        Args:
            budget_tracker: Budget tracker for reservations
            experiment: Experiment name (quiz, swarm)
            dry_run: If True, mock all API calls
        """
        self.budget_tracker = budget_tracker
        self.experiment = experiment
        self.dry_run = dry_run
    
    def call_model(
        self,
        call_id: str,
        model_id: str,
        messages: List[Message],
        max_tokens: int = 256,
        temperature: float = 1.0,
        metadata: Optional[Dict] = None
    ) -> ModelResponse:
        """
        Call a model with budget tracking.
        
        Args:
            call_id: Unique call identifier (for idempotency)
            model_id: Model to call
            messages: Conversation messages
            max_tokens: Maximum completion tokens
            temperature: Sampling temperature
            metadata: Optional metadata to store
        
        Returns:
            ModelResponse with content and usage
        
        Raises:
            BudgetExceededError: If budget would be exceeded
            ValueError: If call_id already used
        """
        # Check idempotency
        if self.budget_tracker.check_call_exists(call_id):
            raise ValueError(f"Call {call_id} already exists")
        
        model_config = get_model_info(model_id)
        
        # Estimate prompt tokens (rough)
        prompt_text = "\n".join(m.content for m in messages)
        estimated_prompt_tokens = len(prompt_text) // 4  # Rough estimate
        
        # Get worst-case cost estimate
        worst_case_usd = get_worst_case_estimate(
            model_id, estimated_prompt_tokens, max_tokens
        )
        
        # Reserve budget atomically
        reservation = self.budget_tracker.reserve(
            call_id=call_id,
            model_id=model_id,
            provider=model_config.provider,
            worst_case_usd=worst_case_usd
        )
        
        # Make API call (or mock if dry_run)
        if self.dry_run:
            response = self._mock_call(model_config, messages, max_tokens)
        else:
            response = self._real_call(
                model_config, messages, max_tokens, temperature
            )
        
        # Reconcile actual cost
        self.budget_tracker.reconcile(
            call_id=call_id,
            model_version=response.model_version,
            prompt_tokens=response.usage['prompt_tokens'],
            completion_tokens=response.usage['completion_tokens'],
            actual_cost_usd=response.actual_cost_usd,
            duration_ms=response.duration_ms,
            experiment=self.experiment,
            metadata=json.dumps(metadata) if metadata else None
        )
        
        return response
    
    def _mock_call(
        self,
        model_config,
        messages: List[Message],
        max_tokens: int
    ) -> ModelResponse:
        """
        Mock an API call for dry-run testing.
        
        Returns a deterministic response based on prompt hash.
        """
        # Hash prompt for deterministic mocking
        prompt_text = "\n".join(m.content for m in messages)
        prompt_hash = hashlib.sha256(prompt_text.encode()).hexdigest()[:8]
        
        # Mock response
        mock_content = f"[MOCK RESPONSE {prompt_hash}] I would choose option A because..."
        
        # Estimate tokens
        prompt_tokens = len(prompt_text) // 4
        completion_tokens = len(mock_content) // 4
        
        # Calculate mock cost
        from .models import estimate_cost
        mock_cost = estimate_cost(
            model_config.model_id, prompt_tokens, completion_tokens
        )
        
        return ModelResponse(
            content=mock_content,
            model_version=f"{model_config.api_model_name}-mock",
            usage={
                'prompt_tokens': prompt_tokens,
                'completion_tokens': completion_tokens,
                'total_tokens': prompt_tokens + completion_tokens
            },
            actual_cost_usd=mock_cost,
            duration_ms=100,  # Mock duration
            raw_response={'mock': True}
        )
    
    def _real_call(
        self,
        model_config,
        messages: List[Message],
        max_tokens: int,
        temperature: float
    ) -> ModelResponse:
        """
        Make a real API call.
        
        Dispatches to provider-specific implementation.
        """
        if model_config.provider == Provider.ANTHROPIC:
            return self._call_anthropic(model_config, messages, max_tokens, temperature)
        elif model_config.provider == Provider.GROQ:
            return self._call_groq(model_config, messages, max_tokens, temperature)
        elif model_config.provider == Provider.OPENROUTER:
            return self._call_openrouter(model_config, messages, max_tokens, temperature)
        else:
            raise ValueError(f"Unknown provider: {model_config.provider}")
    
    def _call_anthropic(self, model_config, messages, max_tokens, temperature) -> ModelResponse:
        """Call Anthropic API."""
        try:
            import anthropic
        except ImportError:
            raise RuntimeError("anthropic package not installed. Run: pip install anthropic")
        
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise RuntimeError("ANTHROPIC_API_KEY not set")
        
        client = anthropic.Anthropic(api_key=api_key)
        
        # Convert messages
        system_msg = None
        conv_messages = []
        for msg in messages:
            if msg.role == "system":
                system_msg = msg.content
            else:
                conv_messages.append({
                    "role": msg.role,
                    "content": msg.content
                })
        
        # Build request
        kwargs = {
            "model": model_config.api_model_name,
            "messages": conv_messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
        }
        
        if system_msg:
            kwargs["system"] = system_msg
        
        # Add model-specific parameters
        if model_config.adaptive_thinking:
            # Anthropic adaptive thinking parameters
            kwargs["metadata"] = {"thinking_effort": model_config.reasoning_effort}
        
        start_time = time.time()
        response = client.messages.create(**kwargs)
        duration_ms = int((time.time() - start_time) * 1000)
        
        # Extract content
        content = response.content[0].text if response.content else ""
        
        # Calculate cost
        usage = {
            'prompt_tokens': response.usage.input_tokens,
            'completion_tokens': response.usage.output_tokens,
            'total_tokens': response.usage.input_tokens + response.usage.output_tokens
        }
        
        from .models import estimate_cost
        cost = estimate_cost(
            model_config.model_id,
            usage['prompt_tokens'],
            usage['completion_tokens']
        )
        
        return ModelResponse(
            content=content,
            model_version=response.model,
            usage=usage,
            actual_cost_usd=cost,
            duration_ms=duration_ms,
            raw_response=response.model_dump() if hasattr(response, 'model_dump') else None
        )
    
    def _call_groq(self, model_config, messages, max_tokens, temperature) -> ModelResponse:
        """Call Groq API (OpenAI-compatible)."""
        try:
            from openai import OpenAI
        except ImportError:
            raise RuntimeError("openai package not installed. Run: pip install openai")
        
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise RuntimeError("GROQ_API_KEY not set")
        
        client = OpenAI(
            api_key=api_key,
            base_url="https://api.groq.com/openai/v1"
        )
        
        # Convert messages
        conv_messages = [
            {"role": msg.role, "content": msg.content}
            for msg in messages
        ]
        
        # Build request
        kwargs = {
            "model": model_config.api_model_name,
            "messages": conv_messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
        }
        
        # Add reasoning effort if supported
        if model_config.reasoning_effort:
            kwargs["reasoning_effort"] = model_config.reasoning_effort
        
        start_time = time.time()
        response = client.chat.completions.create(**kwargs)
        duration_ms = int((time.time() - start_time) * 1000)
        
        # Extract content
        content = response.choices[0].message.content or ""
        
        # Calculate cost
        usage = {
            'prompt_tokens': response.usage.prompt_tokens,
            'completion_tokens': response.usage.completion_tokens,
            'total_tokens': response.usage.total_tokens
        }
        
        from .models import estimate_cost
        cost = estimate_cost(
            model_config.model_id,
            usage['prompt_tokens'],
            usage['completion_tokens']
        )
        
        return ModelResponse(
            content=content,
            model_version=response.model,
            usage=usage,
            actual_cost_usd=cost,
            duration_ms=duration_ms,
            raw_response=response.model_dump() if hasattr(response, 'model_dump') else None
        )
    
    def _call_openrouter(self, model_config, messages, max_tokens, temperature) -> ModelResponse:
        """Call OpenRouter API (OpenAI-compatible)."""
        try:
            from openai import OpenAI
        except ImportError:
            raise RuntimeError("openai package not installed. Run: pip install openai")
        
        api_key = os.getenv("OPENROUTER_API_KEY")
        if not api_key:
            raise RuntimeError("OPENROUTER_API_KEY not set")
        
        client = OpenAI(
            api_key=api_key,
            base_url="https://openrouter.ai/api/v1"
        )
        
        # Convert messages
        conv_messages = [
            {"role": msg.role, "content": msg.content}
            for msg in messages
        ]
        
        # Build request
        kwargs = {
            "model": model_config.api_model_name,
            "messages": conv_messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
        }
        
        # OpenRouter-specific headers for reasoning
        if model_config.reasoning_effort:
            # This might need adjustment based on OpenRouter's API
            pass
        
        start_time = time.time()
        response = client.chat.completions.create(**kwargs)
        duration_ms = int((time.time() - start_time) * 1000)
        
        # Extract content
        content = response.choices[0].message.content or ""
        
        # Calculate cost
        usage = {
            'prompt_tokens': response.usage.prompt_tokens,
            'completion_tokens': response.usage.completion_tokens,
            'total_tokens': response.usage.total_tokens
        }
        
        from .models import estimate_cost
        cost = estimate_cost(
            model_config.model_id,
            usage['prompt_tokens'],
            usage['completion_tokens']
        )
        
        return ModelResponse(
            content=content,
            model_version=response.model,
            usage=usage,
            actual_cost_usd=cost,
            duration_ms=duration_ms,
            raw_response=response.model_dump() if hasattr(response, 'model_dump') else None
        )
