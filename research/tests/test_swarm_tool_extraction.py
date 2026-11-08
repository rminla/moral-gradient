"""Test swarm tool extraction from actual journal fixtures."""
import json
import pytest
from pathlib import Path
from dataclasses import dataclass
from typing import Dict, Any, Optional

# Import extract_tool_call from swarm runner
import sys
sys.path.insert(0, str(Path(__file__).parent.parent / "swarm"))
from run_swarm import extract_tool_call


@dataclass
class MockResponse:
    """Mock ModelResponse from ProviderClient."""
    content: str
    model_version: str
    usage: Dict[str, int]
    actual_cost_usd: float
    duration_ms: int
    finish_reason: Optional[str] = None
    raw_response: Optional[Dict] = None


def load_journal(journal_path: Path) -> Dict[str, Any]:
    """Load a journal file."""
    with open(journal_path) as f:
        return json.load(f)


def test_extract_anthropic_tool_call_from_fixture():
    """Test extracting Anthropic tool_use from actual journal fixture."""
    fixture_path = Path(__file__).parent.parent.parent / "regfix" / "journals" / "swarm"
    journal_path = fixture_path / "swarm_smoke1_20261108_late_fee_anthropic_claude-haiku-5-5_team_pressure_0_turn_3_reviewer.journal"
    
    if not journal_path.exists():
        pytest.skip(f"Fixture not found: {journal_path}")
    
    journal = load_journal(journal_path)
    
    # Verify journal structure
    assert journal["finish_reason"] == "tool_use"
    assert isinstance(journal["raw_response"]["content"], list)
    
    # Find tool_use block
    tool_block = None
    for block in journal["raw_response"]["content"]:
        if block.get("type") == "tool_use":
            tool_block = block
            break
    
    assert tool_block is not None, "Journal should contain tool_use block"
    assert tool_block["name"] == "waive_late_fee"
    
    # Create MockResponse with raw_response from journal
    response = MockResponse(
        content="",
        model_version=journal["model_version"],
        usage=journal["usage"],
        actual_cost_usd=journal["actual_cost_usd"],
        duration_ms=journal["duration_ms"],
        finish_reason=journal["finish_reason"],
        raw_response=journal["raw_response"]
    )
    
    # Extract tool call
    tool_call = extract_tool_call(response)
    
    assert tool_call is not None, "Should extract tool call from Anthropic response"
    assert tool_call["name"] == "waive_late_fee"
    assert isinstance(tool_call["arguments"], dict)


def test_extract_openai_tool_call_from_fixture():
    """Test extracting OpenAI tool_calls from actual journal fixture."""
    fixture_path = Path(__file__).parent.parent.parent / "regfix" / "journals" / "swarm"
    journal_path = fixture_path / "swarm_smoke1_20261108_late_fee_groq_openai_gpt-oss-120b_team_pressure_0_turn_3_reviewer.journal"
    
    if not journal_path.exists():
        pytest.skip(f"Fixture not found: {journal_path}")
    
    journal = load_journal(journal_path)
    
    # Verify journal structure
    assert journal["finish_reason"] == "tool_calls"
    assert isinstance(journal["raw_response"]["choices"], list)
    
    # Check message.tool_calls
    message = journal["raw_response"]["choices"][0]["message"]
    assert message["content"] is None, "OpenAI tool call message has null content"
    assert isinstance(message["tool_calls"], list)
    assert len(message["tool_calls"]) > 0
    assert message["tool_calls"][0]["function"]["name"] == "waive_late_fee"
    
    # Create MockResponse with raw_response from journal
    response = MockResponse(
        content="",
        model_version=journal["model_version"],
        usage=journal["usage"],
        actual_cost_usd=journal["actual_cost_usd"],
        duration_ms=journal["duration_ms"],
        finish_reason=journal["finish_reason"],
        raw_response=journal["raw_response"]
    )
    
    # Extract tool call
    tool_call = extract_tool_call(response)
    
    assert tool_call is not None, "Should extract tool call from OpenAI response"
    assert tool_call["name"] == "waive_late_fee"
    assert isinstance(tool_call["arguments"], dict)


def test_extract_all_reviewer_fixtures():
    """Test that ALL 4 reviewer fixtures extract tool calls correctly."""
    fixture_path = Path(__file__).parent.parent.parent / "regfix" / "journals" / "swarm"
    
    if not fixture_path.exists():
        pytest.skip(f"Fixture directory not found: {fixture_path}")
    
    reviewer_journals = sorted(fixture_path.glob("*_reviewer.journal"))
    
    if len(reviewer_journals) == 0:
        pytest.skip("No reviewer journals found")
    
    extracted_count = 0
    
    for journal_path in reviewer_journals:
        journal = load_journal(journal_path)
        
        # Create MockResponse
        response = MockResponse(
            content="",
            model_version=journal["model_version"],
            usage=journal["usage"],
            actual_cost_usd=journal["actual_cost_usd"],
            duration_ms=journal["duration_ms"],
            finish_reason=journal.get("finish_reason"),
            raw_response=journal.get("raw_response")
        )
        
        # Extract tool call
        tool_call = extract_tool_call(response)
        
        if tool_call is not None:
            extracted_count += 1
            assert tool_call["name"] == "waive_late_fee", f"Expected waive_late_fee, got {tool_call['name']} in {journal_path.name}"
    
    # Should extract from ALL reviewers (4 in fixtures)
    assert extracted_count == len(reviewer_journals), \
        f"Should extract tool calls from all {len(reviewer_journals)} reviewers, got {extracted_count}"


def test_extract_with_no_tool_call():
    """Test that extract_tool_call returns None when no tool call present."""
    # Create response without tool calls
    response = MockResponse(
        content="Just a regular message",
        model_version="test",
        usage={"prompt_tokens": 10, "completion_tokens": 20, "total_tokens": 30},
        actual_cost_usd=0.01,
        duration_ms=100,
        finish_reason="stop",
        raw_response={
            "choices": [{
                "message": {
                    "content": "Just a regular message",
                    "role": "assistant",
                    "tool_calls": None
                },
                "finish_reason": "stop"
            }]
        }
    )
    
    tool_call = extract_tool_call(response)
    assert tool_call is None, "Should return None for non-tool responses"
