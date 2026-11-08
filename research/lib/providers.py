"""Provider client wrappers with cost tracking and error handling."""

import hashlib
import json
import os
import time
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from .budget import BudgetTracker
from .journal import JournalEntry, ResponseJournal, hash_content
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
    finish_reason: Optional[str] = None  # stop, length, error, etc
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
        dry_run: bool = False,
        journal_dir: Optional[Path] = None
    ):
        """
        Initialize provider client.
        
        Args:
            budget_tracker: Budget tracker for reservations
            experiment: Experiment name (quiz, swarm)
            dry_run: If True, mock all API calls
            journal_dir: Journal directory (defaults to ledger parent dir)
        """
        self.budget_tracker = budget_tracker
        self.experiment = experiment
        self.dry_run = dry_run
        
        # Initialize durable journal (defaults to same dir as ledger)
        if journal_dir is None:
            journal_dir = budget_tracker.db_path.parent / "journal"
        self.journal = ResponseJournal(journal_dir)
    
    def _get_model_config(self, model_id: str):
        """Helper to get model config (for testing)."""
        return get_model_info(model_id)
    
    def call_model(
        self,
        call_id: str,
        model_id: str,
        messages: List[Message],
        max_tokens: int = 2048,
        temperature: float = 1.0,
        tools: Optional[List[Dict]] = None,
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
            tools: Optional tool definitions for function calling
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
        try:
            if self.dry_run:
                response = self._mock_call(model_config, messages, max_tokens, tools)
            else:
                response = self._real_call(
                    model_config, messages, max_tokens, temperature, tools
                )
        except Exception as call_error:
            # Journal the failure BEFORE releasing reservation
            journal_entry = JournalEntry(
                call_id=call_id,
                timestamp=datetime.utcnow().isoformat() + "Z",
                model_id=model_config.model_id,
                model_version="error",
                provider=model_config.provider.value,
                experiment=self.experiment,
                usage={"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
                actual_cost_usd=0.0,
                duration_ms=0,
                finish_reason="error",
                content_hash="",
                raw_response=None,
                metadata=None,
                error=str(call_error)
            )
            self.journal.write(journal_entry)
            
            # Release reservation
            try:
                self.budget_tracker.reconcile(
                    call_id=call_id,
                    model_version='error',
                    prompt_tokens=0,
                    completion_tokens=0,
                    actual_cost_usd=0.0,
                    duration_ms=0,
                    experiment=self.experiment,
                    error=str(call_error)
                )
            except:
                pass  # Journal preserved, ledger best-effort
            raise call_error
        
        # JOURNAL FIRST: durable write before fragile ledger reconcile
        journal_entry = JournalEntry(
            call_id=call_id,
            timestamp=datetime.utcnow().isoformat() + "Z",
            model_id=model_config.model_id,
            model_version=response.model_version,
            provider=model_config.provider.value,
            experiment=self.experiment,
            usage=response.usage,
            actual_cost_usd=response.actual_cost_usd,
            duration_ms=response.duration_ms,
            finish_reason=response.finish_reason,
            content_hash=hash_content(response.content),
            raw_response=response.raw_response,
            metadata=json.dumps(metadata) if metadata else None
        )
        self.journal.write(journal_entry)
        
        # Reconcile actual cost (journal already written, safe to fail)
        try:
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
        except Exception as reconcile_error:
            # Journal preserved! Can recover later
            print(f"Warning: Ledger write failed for {call_id}, journal preserved: {reconcile_error}")
            # Try to release reservation at least
            try:
                self.budget_tracker.reconcile(
                    call_id=call_id,
                    model_version='ledger_error',
                    prompt_tokens=0,
                    completion_tokens=0,
                    actual_cost_usd=0.0,
                    duration_ms=response.duration_ms,
                    experiment=self.experiment,
                    error=f"Ledger write failed: {reconcile_error}"
                )
            except:
                pass  # Journal is safe, that's what matters
            raise reconcile_error
        
        return response
    
    def _mock_call(
        self,
        model_config,
        messages: List[Message],
        max_tokens: int,
        tools: Optional[List[Dict]] = None
    ) -> ModelResponse:
        """
        Mock an API call for dry-run testing.
        
        Returns a deterministic response based on prompt hash.
        Tools parameter is accepted but not used in mock.
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
            finish_reason="stop",
            raw_response={'mock': True}
        )
    
    def _real_call(
        self,
        model_config,
        messages: List[Message],
        max_tokens: int,
        temperature: float,
        tools: Optional[List[Dict]] = None
    ) -> ModelResponse:
        """
        Make a real API call.
        
        Dispatches to provider-specific implementation.
        """
        if model_config.provider == Provider.ANTHROPIC:
            return self._call_anthropic(model_config, messages, max_tokens, temperature, tools)
        elif model_config.provider == Provider.GROQ:
            return self._call_groq(model_config, messages, max_tokens, temperature, tools)
        elif model_config.provider == Provider.OPENROUTER:
            return self._call_openrouter(model_config, messages, max_tokens, temperature, tools)
        else:
            raise ValueError(f"Unknown provider: {model_config.provider}")
    
    def _call_anthropic(self, model_config, messages, max_tokens, temperature, tools=None) -> ModelResponse:
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
        
        # Build request (Anthropic SDK 2.6.0: NO temperature parameter)
        kwargs = {
            "model": model_config.api_model_name,
            "messages": conv_messages,
            "max_tokens": max_tokens,
        }
        
        if system_msg:
            kwargs["system"] = system_msg
        
        if tools:
            kwargs["tools"] = tools
        
        # Add thinking configuration for reasoning models (exact v3 config)
        if model_config.adaptive_thinking or model_config.reasoning_effort:
            kwargs["thinking"] = {
                "type": "adaptive",
                "display": "summarized"
            }
            kwargs["output_config"] = {
                "effort": model_config.reasoning_effort or "medium"
            }
        
        start_time = time.time()
        try:
            response = client.messages.create(**kwargs)
            duration_ms = int((time.time() - start_time) * 1000)
        except Exception as e:
            duration_ms = int((time.time() - start_time) * 1000)
            # Check for permanent errors that should circuit break
            error_str = str(e).lower()
            if any(code in error_str for code in ['400', '401', '403', '404', 'credit', 'quota', 'overloaded']):
                raise RuntimeError(f"Anthropic permanent error (circuit break): {e}")
            raise
        
        # Extract content (concatenate all text blocks, thinking may come first)
        content_parts = []
        if response.content:
            for block in response.content:
                if hasattr(block, 'text'):
                    content_parts.append(block.text)
        content = "\n".join(content_parts) if content_parts else ""
        
        # Calculate cost (account for all token types including thinking)
        input_tokens = response.usage.input_tokens
        output_tokens = response.usage.output_tokens
        
        # Account for thinking tokens if present (added to output count)
        if hasattr(response.usage, 'thinking_tokens') and response.usage.thinking_tokens:
            output_tokens += response.usage.thinking_tokens
        
        usage = {
            'prompt_tokens': input_tokens,
            'completion_tokens': output_tokens,
            'total_tokens': input_tokens + output_tokens
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
            finish_reason=response.stop_reason if hasattr(response, 'stop_reason') else None,
            raw_response=response.model_dump() if hasattr(response, 'model_dump') else None
        )
    
    def _call_groq(self, model_config, messages, max_tokens, temperature, tools=None) -> ModelResponse:
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
        
        # Build request (model-specific params from v3)
        kwargs = {
            "model": model_config.api_model_name,
            "messages": conv_messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
        }
        
        if tools:
            kwargs["tools"] = tools
        
        # Model-specific parameters (exact v3 format)
        # NOTE: reasoning_format must be in extra_body for OpenAI SDK, not top-level
        if model_config.model_id == "groq/qwen/qwen3.6-27b":
            # Qwen uses reasoning_format in extra_body
            kwargs["extra_body"] = {"reasoning_format": "parsed"}
        elif model_config.reasoning_effort:
            # Other models (gpt-oss) use reasoning_effort
            kwargs["reasoning_effort"] = model_config.reasoning_effort
        
        start_time = time.time()
        try:
            response = client.chat.completions.create(**kwargs)
            duration_ms = int((time.time() - start_time) * 1000)
        except Exception as e:
            duration_ms = int((time.time() - start_time) * 1000)
            # Check for permanent errors that should circuit break
            error_str = str(e).lower()
            if any(code in error_str for code in ['400', '401', '403', '404', 'credit', 'quota']):
                raise RuntimeError(f"Groq permanent error (circuit break): {e}")
            raise
        
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
            finish_reason=response.choices[0].finish_reason if response.choices else None,
            raw_response=response.model_dump() if hasattr(response, 'model_dump') else None
        )
    
    def _call_openrouter(self, model_config, messages, max_tokens, temperature, tools=None) -> ModelResponse:
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
        
        if tools:
            kwargs["tools"] = tools
        
        # OpenRouter-specific headers for reasoning
        if model_config.reasoning_effort:
            # This might need adjustment based on OpenRouter's API
            pass
        
        start_time = time.time()
        try:
            response = client.chat.completions.create(**kwargs)
            duration_ms = int((time.time() - start_time) * 1000)
        except Exception as e:
            duration_ms = int((time.time() - start_time) * 1000)
            # Check for permanent errors that should circuit break
            error_str = str(e).lower()
            if any(code in error_str for code in ['400', '401', '403', '404', 'credit', 'quota']):
                raise RuntimeError(f"OpenRouter permanent error (circuit break): {e}")
            raise
        
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
            finish_reason=response.choices[0].finish_reason if response.choices else None,
            raw_response=response.model_dump() if hasattr(response, 'model_dump') else None
        )
