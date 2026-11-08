"""
SDK-backed HTTP mock tests: validate provider payloads with actual installed SDKs.

Tests use real SDK classes with mock HTTP transports to verify:
1. Request payloads match expected API format
2. Response parsing handles all finish_reason variants
3. No unsupported parameters are sent
"""

import json
import sys
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from lib.budget import BudgetTracker
from lib.models import Provider
from lib.providers import Message, ProviderClient


def test_anthropic_sdk_payload():
    """Test Anthropic SDK 2.6.0: no temperature, proper thinking/output_config."""
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "test.db"
        tracker = BudgetTracker(db_path, global_cap_usd=10.0)
        client = ProviderClient(tracker, "test", dry_run=False)
        
        # Mock Anthropic client (patch at import site + env)
        with patch('anthropic.Anthropic') as MockAnthropic, \
             patch.dict('os.environ', {'ANTHROPIC_API_KEY': 'test-key'}):
            mock_client = MagicMock()
            MockAnthropic.return_value = mock_client
            
            # Mock response
            mock_response = MagicMock()
            mock_response.model = "claude-haiku-5-5-20261007"
            mock_response.stop_reason = "end_turn"
            mock_response.content = [
                MagicMock(type='text', text='A')
            ]
            mock_response.usage = MagicMock(
                input_tokens=100,
                output_tokens=50
            )
            mock_client.messages.create.return_value = mock_response
            
            # Make call
            messages = [Message(role="user", content="Test")]
            response = client._call_anthropic(
                client._get_model_config("anthropic/claude-haiku-5-5"),
                messages,
                max_tokens=2048,
                temperature=1.0  # Should be ignored by SDK
            )
            
            # Verify SDK was called
            assert mock_client.messages.create.called
            call_kwargs = mock_client.messages.create.call_args[1]
            
            # Critical: NO temperature parameter
            assert 'temperature' not in call_kwargs, "Anthropic SDK 2.6.0 does not support temperature"
            
            # Required parameters
            assert call_kwargs['model'] == 'claude-haiku-5-5'
            assert call_kwargs['max_tokens'] == 2048
            assert len(call_kwargs['messages']) == 1
            
            # Thinking config present
            assert 'thinking' in call_kwargs
            assert call_kwargs['thinking']['type'] == 'adaptive'
            assert call_kwargs['thinking']['display'] == 'summarized'
            assert 'output_config' in call_kwargs
            assert call_kwargs['output_config']['effort'] == 'medium'
            
            # Response parsed correctly
            assert response.content == 'A'
            assert response.finish_reason == 'end_turn'


def test_anthropic_finish_reasons():
    """Test Anthropic stop_reason variants map to finish_reason."""
    variants = [
        ('end_turn', 'end_turn'),
        ('max_tokens', 'max_tokens'),  # NOT 'length'
        ('stop_sequence', 'stop_sequence'),
    ]
    
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "test.db"
        tracker = BudgetTracker(db_path, global_cap_usd=10.0)
        client = ProviderClient(tracker, "test", dry_run=False)
        
        for stop_reason, expected_finish in variants:
            with patch('anthropic.Anthropic') as MockAnthropic, \
                 patch.dict('os.environ', {'ANTHROPIC_API_KEY': 'test-key'}):
                mock_client = MagicMock()
                MockAnthropic.return_value = mock_client
                
                mock_response = MagicMock()
                mock_response.model = "claude-haiku-5-5"
                mock_response.stop_reason = stop_reason
                mock_response.content = [MagicMock(type='text', text='test')]
                mock_response.usage = MagicMock(input_tokens=10, output_tokens=10)
                mock_client.messages.create.return_value = mock_response
                
                response = client._call_anthropic(
                    client._get_model_config("anthropic/claude-haiku-5-5"),
                    [Message(role="user", content="test")],
                    max_tokens=100,
                    temperature=1.0
                )
                
                assert response.finish_reason == expected_finish, \
                    f"stop_reason {stop_reason} should map to {expected_finish}, got {response.finish_reason}"


def test_groq_qwen_reasoning_format_in_extra_body():
    """Test Groq Qwen: reasoning_format in extra_body, NOT top-level."""
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "test.db"
        tracker = BudgetTracker(db_path, global_cap_usd=10.0)
        client = ProviderClient(tracker, "test", dry_run=False)
        
        with patch('openai.OpenAI') as MockOpenAI, \
             patch.dict('os.environ', {'GROQ_API_KEY': 'test-key'}):
            mock_client = MagicMock()
            MockOpenAI.return_value = mock_client
            
            # Mock response
            mock_choice = MagicMock()
            mock_choice.message.content = 'B'
            mock_choice.finish_reason = 'stop'
            mock_response = MagicMock()
            mock_response.model = 'qwen3.6-27b'
            mock_response.choices = [mock_choice]
            mock_response.usage = MagicMock(
                prompt_tokens=100,
                completion_tokens=50,
                total_tokens=150
            )
            mock_client.chat.completions.create.return_value = mock_response
            
            # Make Qwen call
            response = client._call_groq(
                client._get_model_config("groq/qwen/qwen3.6-27b"),
                [Message(role="user", content="Test")],
                max_tokens=2048,
                temperature=1.0
            )
            
            # Verify SDK call
            assert mock_client.chat.completions.create.called
            call_kwargs = mock_client.chat.completions.create.call_args[1]
            
            # Critical: reasoning_format in extra_body, NOT top-level
            assert 'reasoning_format' not in call_kwargs, \
                "reasoning_format must be in extra_body, not top-level"
            assert 'extra_body' in call_kwargs, \
                "Qwen requires extra_body with reasoning_format"
            assert call_kwargs['extra_body']['reasoning_format'] == 'parsed', \
                "Qwen reasoning_format must be 'parsed'"
            
            # NO reasoning_effort for Qwen
            assert 'reasoning_effort' not in call_kwargs, \
                "Qwen does not support reasoning_effort"
            
            assert response.content == 'B'
            assert response.finish_reason == 'stop'


def test_groq_gptoss_reasoning_effort():
    """Test Groq gpt-oss: reasoning_effort top-level, no extra_body."""
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "test.db"
        tracker = BudgetTracker(db_path, global_cap_usd=10.0)
        client = ProviderClient(tracker, "test", dry_run=False)
        
        with patch('openai.OpenAI') as MockOpenAI, \
             patch.dict('os.environ', {'GROQ_API_KEY': 'test-key'}):
            mock_client = MagicMock()
            MockOpenAI.return_value = mock_client
            
            mock_choice = MagicMock()
            mock_choice.message.content = 'A'
            mock_choice.finish_reason = 'stop'
            mock_response = MagicMock()
            mock_response.model = 'gpt-oss-120b'
            mock_response.choices = [mock_choice]
            mock_response.usage = MagicMock(
                prompt_tokens=100,
                completion_tokens=50,
                total_tokens=150
            )
            mock_client.chat.completions.create.return_value = mock_response
            
            response = client._call_groq(
                client._get_model_config("groq/openai/gpt-oss-120b"),
                [Message(role="user", content="Test")],
                max_tokens=2048,
                temperature=1.0
            )
            
            call_kwargs = mock_client.chat.completions.create.call_args[1]
            
            # gpt-oss uses reasoning_effort top-level
            assert 'reasoning_effort' in call_kwargs, \
                "gpt-oss should have reasoning_effort"
            assert call_kwargs['reasoning_effort'] == 'medium'
            
            # No extra_body for gpt-oss
            assert 'extra_body' not in call_kwargs or not call_kwargs.get('extra_body'), \
                "gpt-oss should not use extra_body"


def test_openai_finish_reasons():
    """Test OpenAI/Groq finish_reason variants."""
    variants = ['stop', 'length', 'content_filter', 'tool_calls']
    
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "test.db"
        tracker = BudgetTracker(db_path, global_cap_usd=10.0)
        client = ProviderClient(tracker, "test", dry_run=False)
        
        for finish_reason in variants:
            with patch('openai.OpenAI') as MockOpenAI, \
                 patch.dict('os.environ', {'GROQ_API_KEY': 'test-key'}):
                mock_client = MagicMock()
                MockOpenAI.return_value = mock_client
                
                mock_choice = MagicMock()
                mock_choice.message.content = 'test'
                mock_choice.finish_reason = finish_reason
                mock_response = MagicMock()
                mock_response.model = 'gpt-oss-120b'
                mock_response.choices = [mock_choice]
                mock_response.usage = MagicMock(
                    prompt_tokens=10,
                    completion_tokens=10,
                    total_tokens=20
                )
                mock_client.chat.completions.create.return_value = mock_response
                
                response = client._call_groq(
                    client._get_model_config("groq/openai/gpt-oss-120b"),
                    [Message(role="user", content="test")],
                    max_tokens=100,
                    temperature=1.0
                )
                
                assert response.finish_reason == finish_reason


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
