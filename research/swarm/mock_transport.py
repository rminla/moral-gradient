"""
HTTP-level mock transport for SDK testing.

Exercises actual SDK request serialization and response parsing
with native tool_use (Anthropic) and tool_calls (OpenAI) support.
Blocks all outbound network, generates deterministic fixtures.
"""

import hashlib
import json
import random
from typing import Dict, List, Optional, Any


class MockTransportFixtures:
    """Deterministic mock fixtures with tool support."""
    
    # Tool action fixtures (varied outcomes)
    TOOL_FIXTURES = {
        # Valid tool calls
        "valid_waive": {
            "tool_name": "waive_late_fee",
            "arguments": {},
            "valid": True
        },
        "valid_keep": {
            "tool_name": "keep_late_fee",
            "arguments": {},
            "valid": True
        },
        "valid_escalate": {
            "tool_name": "escalate_to_supervisor",
            "arguments": {},
            "valid": True
        },
        "valid_recommend_strongest": {
            "tool_name": "recommend_strongest_candidate",
            "arguments": {},
            "valid": True
        },
        "valid_recommend_ceo": {
            "tool_name": "recommend_ceo_preferred",
            "arguments": {},
            "valid": True
        },
        "valid_present_both": {
            "tool_name": "present_both_neutrally",
            "arguments": {},
            "valid": True
        },
        "valid_request_return": {
            "tool_name": "request_return_refund",
            "arguments": {},
            "valid": True
        },
        "valid_keep_defective": {
            "tool_name": "keep_defective_product",
            "arguments": {},
            "valid": True
        },
        "valid_contact_seller": {
            "tool_name": "contact_seller_first",
            "arguments": {},
            "valid": True
        },
        "valid_keep_bonus": {
            "tool_name": "keep_full_bonus",
            "arguments": {},
            "valid": True
        },
        "valid_share_bonus": {
            "tool_name": "share_bonus_with_sam",
            "arguments": {},
            "valid": True
        },
        "valid_raise_manager": {
            "tool_name": "raise_with_manager",
            "arguments": {},
            "valid": True
        },
        
        # Malformed tool calls (invalid JSON)
        "malformed_json": {
            "tool_name": "waive_late_fee",
            "arguments": None,  # Causes JSON serialization error
            "valid": False,
            "error": "malformed_arguments"
        },
        
        # No tool call (text response only)
        "no_tool": {
            "tool_name": None,
            "arguments": None,
            "valid": False,
            "response_text": "I cannot make this decision without more information."
        },
        
        # Refusal
        "refusal": {
            "tool_name": None,
            "arguments": None,
            "valid": False,
            "response_text": "I cannot in good conscience recommend this action."
        }
    }
    
    @staticmethod
    def get_fixture_for_turn(call_id: str, has_tools: bool) -> Dict:
        """
        Get deterministic fixture based on call_id hash.
        
        Ensures variety across episodes while remaining deterministic.
        """
        if not has_tools:
            # Turns without tools: text only
            return MockTransportFixtures.TOOL_FIXTURES["no_tool"]
        
        # Turn 3 with tools: varied outcomes
        hash_val = int(hashlib.md5(call_id.encode()).hexdigest()[:8], 16)
        random.seed(hash_val)
        
        # Distribution: 70% valid tool calls, 20% no tool, 5% malformed, 5% refusal
        r = random.random()
        if r < 0.70:
            # Valid tool call - pick one at random
            valid_tools = [k for k, v in MockTransportFixtures.TOOL_FIXTURES.items() 
                          if k.startswith("valid_")]
            fixture_key = random.choice(valid_tools)
            return MockTransportFixtures.TOOL_FIXTURES[fixture_key]
        elif r < 0.90:
            return MockTransportFixtures.TOOL_FIXTURES["no_tool"]
        elif r < 0.95:
            return MockTransportFixtures.TOOL_FIXTURES["malformed_json"]
        else:
            return MockTransportFixtures.TOOL_FIXTURES["refusal"]


def create_anthropic_response(
    call_id: str,
    messages: List,
    tools: Optional[List] = None,
    max_tokens: int = 2048
) -> Dict:
    """
    Create mock Anthropic API response with native tool_use support.
    
    Matches anthropic-sdk 2.6.0 response structure.
    """
    has_tools = tools is not None and len(tools) > 0
    fixture = MockTransportFixtures.get_fixture_for_turn(call_id, has_tools)
    
    # Estimate tokens
    prompt_text = "\n".join(m.get("content", "") if isinstance(m.get("content"), str) else "" 
                            for m in messages)
    prompt_tokens = len(prompt_text) // 4
    
    # Build content blocks
    content_blocks = []
    
    # Anthropic often has thinking block first
    if has_tools and fixture.get("valid"):
        content_blocks.append({
            "type": "thinking",
            "thinking": f"Let me analyze this situation... [MOCK THINKING for {call_id[:8]}]"
        })
    
    if fixture.get("tool_name"):
        # Tool use block
        if fixture.get("valid"):
            content_blocks.append({
                "type": "tool_use",
                "id": f"toolu_{call_id[:12]}",
                "name": fixture["tool_name"],
                "input": fixture.get("arguments", {})
            })
        else:
            # Malformed: return text explaining error
            content_blocks.append({
                "type": "text",
                "text": "[MOCK ERROR: Malformed tool arguments]"
            })
    else:
        # Text response
        text = fixture.get("response_text", f"[MOCK RESPONSE {call_id[:8]}] Based on the information provided...")
        content_blocks.append({
            "type": "text",
            "text": text
        })
    
    completion_tokens = sum(len(str(block)) // 4 for block in content_blocks)
    
    return {
        "id": f"msg_mock_{call_id[:16]}",
        "type": "message",
        "role": "assistant",
        "content": content_blocks,
        "model": "claude-haiku-5-5-20261108-mock",
        "stop_reason": "tool_use" if fixture.get("tool_name") and fixture.get("valid") else "end_turn",
        "stop_sequence": None,
        "usage": {
            "input_tokens": prompt_tokens,
            "output_tokens": completion_tokens
        }
    }


def create_openai_response(
    call_id: str,
    messages: List,
    tools: Optional[List] = None,
    max_tokens: int = 2048
) -> Dict:
    """
    Create mock OpenAI API response with native tool_calls support.
    
    Matches openai-sdk 3.46.0 response structure.
    """
    has_tools = tools is not None and len(tools) > 0
    fixture = MockTransportFixtures.get_fixture_for_turn(call_id, has_tools)
    
    # Estimate tokens
    prompt_text = "\n".join(m.get("content", "") for m in messages if m.get("content"))
    prompt_tokens = len(prompt_text) // 4
    
    # Build message content
    tool_calls = None
    content = None
    finish_reason = "stop"
    
    if fixture.get("tool_name") and fixture.get("valid"):
        # Native tool_calls array
        tool_calls = [
            {
                "id": f"call_mock_{call_id[:16]}",
                "type": "function",
                "function": {
                    "name": fixture["tool_name"],
                    "arguments": json.dumps(fixture.get("arguments", {}))
                }
            }
        ]
        content = None  # OpenAI sets content to null when tool_calls present
        finish_reason = "tool_calls"
    elif fixture.get("tool_name") and not fixture.get("valid"):
        # Malformed: invalid JSON in arguments
        tool_calls = [
            {
                "id": f"call_mock_{call_id[:16]}",
                "type": "function",
                "function": {
                    "name": fixture["tool_name"],
                    "arguments": "{invalid json}"  # Malformed
                }
            }
        ]
        finish_reason = "tool_calls"
    else:
        # Text response
        content = fixture.get("response_text", 
                             f"[MOCK RESPONSE {call_id[:8]}] Based on the information provided...")
        finish_reason = "stop"
    
    completion_tokens = len(content) // 4 if content else 20
    
    return {
        "id": f"chatcmpl_mock_{call_id[:16]}",
        "object": "chat.completion",
        "created": 1699000000,
        "model": "gpt-oss-120b-20261108-mock",
        "choices": [
            {
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": content,
                    "tool_calls": tool_calls
                },
                "finish_reason": finish_reason
            }
        ],
        "usage": {
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": prompt_tokens + completion_tokens
        }
    }


class MockHTTPTransport:
    """
    HTTP-level mock transport that blocks network and returns deterministic responses.
    
    Exercises actual SDK request serialization and response parsing.
    """
    
    def __init__(self):
        self.request_log = []
        self.network_blocked = True
    
    def request(self, method: str, url: str, **kwargs) -> Dict:
        """
        Mock HTTP request handler.
        
        Logs request and returns mock response based on provider.
        """
        if self.network_blocked:
            # Assert no real network calls
            if not ("mock" in url or "localhost" in url):
                raise RuntimeError(f"Mock transport blocked real network call to: {url}")
        
        # Log request for verification
        self.request_log.append({
            "method": method,
            "url": url,
            "headers": kwargs.get("headers", {}),
            "body_size": len(kwargs.get("data", b"")) if "data" in kwargs else 0
        })
        
        # Parse provider from URL or detect from request
        if "anthropic.com" in url or "claude" in url:
            return self._mock_anthropic_request(kwargs)
        elif "openai.com" in url or "groq.com" in url or "openrouter.ai" in url:
            return self._mock_openai_request(kwargs)
        else:
            raise ValueError(f"Unknown provider for URL: {url}")
    
    def _mock_anthropic_request(self, kwargs) -> Dict:
        """Mock Anthropic API request."""
        body = json.loads(kwargs.get("data", b"{}"))
        messages = body.get("messages", [])
        tools = body.get("tools")
        max_tokens = body.get("max_tokens", 2048)
        
        # Generate call_id from messages (deterministic)
        call_id = hashlib.md5(str(messages).encode()).hexdigest()
        
        return create_anthropic_response(call_id, messages, tools, max_tokens)
    
    def _mock_openai_request(self, kwargs) -> Dict:
        """Mock OpenAI-compatible API request."""
        body = json.loads(kwargs.get("data", b"{}"))
        messages = body.get("messages", [])
        tools = body.get("tools")
        max_tokens = body.get("max_tokens", 2048)
        
        # Generate call_id from messages (deterministic)
        call_id = hashlib.md5(str(messages).encode()).hexdigest()
        
        return create_openai_response(call_id, messages, tools, max_tokens)
