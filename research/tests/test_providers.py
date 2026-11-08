"""Tests for provider client with mock calls."""

import tempfile
from pathlib import Path

import pytest

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from lib.budget import BudgetTracker
from lib.providers import Message, ProviderClient
from lib.models import Provider


def test_mock_call():
    """Test mock API call in dry-run mode."""
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "test.db"
        tracker = BudgetTracker(db_path, global_cap_usd=10.0)
        
        client = ProviderClient(
            budget_tracker=tracker,
            experiment="test",
            dry_run=True
        )
        
        # Make mock call
        response = client.call_model(
            call_id="test_mock_call",
            model_id="anthropic/claude-haiku-5-5",
            messages=[
                Message(role="user", content="Test prompt")
            ],
            max_tokens=100,
            temperature=1.0
        )
        
        # Check response
        assert response.content.startswith("[MOCK RESPONSE")
        assert response.model_version.endswith("-mock")
        assert response.usage["prompt_tokens"] > 0
        assert response.usage["completion_tokens"] > 0
        assert response.actual_cost_usd > 0
        
        # Verify budget was tracked
        status = tracker.get_status()
        assert status.global_spent_usd == response.actual_cost_usd


def test_mock_deterministic():
    """Test that mock calls are deterministic."""
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "test.db"
        tracker = BudgetTracker(db_path, global_cap_usd=10.0)
        
        client = ProviderClient(
            budget_tracker=tracker,
            experiment="test",
            dry_run=True
        )
        
        # Same prompt should produce same mock response content hash
        prompt = "What is 2+2?"
        
        response1 = client.call_model(
            call_id="test_1",
            model_id="anthropic/claude-haiku-5-5",
            messages=[Message(role="user", content=prompt)],
            max_tokens=100
        )
        
        response2 = client.call_model(
            call_id="test_2",
            model_id="anthropic/claude-haiku-5-5",
            messages=[Message(role="user", content=prompt)],
            max_tokens=100
        )
        
        # Should have same hash in content (both contain same prompt hash)
        assert response1.content.split()[2] == response2.content.split()[2]


def test_idempotency_check():
    """Test that duplicate call_ids are rejected."""
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "test.db"
        tracker = BudgetTracker(db_path, global_cap_usd=10.0)
        
        client = ProviderClient(
            budget_tracker=tracker,
            experiment="test",
            dry_run=True
        )
        
        # First call succeeds
        client.call_model(
            call_id="duplicate_test",
            model_id="anthropic/claude-haiku-5-5",
            messages=[Message(role="user", content="Test")],
            max_tokens=100
        )
        
        # Duplicate call_id should fail
        with pytest.raises(ValueError, match="already exists"):
            client.call_model(
                call_id="duplicate_test",
                model_id="anthropic/claude-haiku-5-5",
                messages=[Message(role="user", content="Test")],
                max_tokens=100
            )


def test_budget_tracking_integration():
    """Test that provider client properly tracks budget."""
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "test.db"
        tracker = BudgetTracker(db_path, global_cap_usd=1.0)
        
        client = ProviderClient(
            budget_tracker=tracker,
            experiment="test",
            dry_run=True
        )
        
        # Make several calls
        total_cost = 0.0
        for i in range(5):
            response = client.call_model(
                call_id=f"call_{i}",
                model_id="anthropic/claude-haiku-5-5",
                messages=[Message(role="user", content="Test")],
                max_tokens=50
            )
            total_cost += response.actual_cost_usd
        
        # Check total tracked cost
        status = tracker.get_status()
        assert abs(status.global_spent_usd - total_cost) < 0.0001


def test_multiple_models():
    """Test calls to different models."""
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "test.db"
        tracker = BudgetTracker(db_path, global_cap_usd=10.0)
        
        client = ProviderClient(
            budget_tracker=tracker,
            experiment="test",
            dry_run=True
        )
        
        models = [
            "anthropic/claude-haiku-5-5",
            "groq/openai/gpt-oss-120b",
            "openrouter/google/gemini-3.8-flash"
        ]
        
        for i, model_id in enumerate(models):
            response = client.call_model(
                call_id=f"model_test_{i}",
                model_id=model_id,
                messages=[Message(role="user", content="Test")],
                max_tokens=100
            )
            
            assert response.model_version.endswith("-mock")
            assert response.actual_cost_usd > 0


def test_cost_estimation():
    """Test that different models have different costs."""
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "test.db"
        tracker = BudgetTracker(db_path, global_cap_usd=10.0)
        
        client = ProviderClient(
            budget_tracker=tracker,
            experiment="test",
            dry_run=True
        )
        
        # Haiku (cheap)
        haiku_response = client.call_model(
            call_id="haiku_test",
            model_id="anthropic/claude-haiku-5-5",
            messages=[Message(role="user", content="Test prompt " * 50)],
            max_tokens=100
        )
        
        # Gemini (expensive)
        gemini_response = client.call_model(
            call_id="gemini_test",
            model_id="openrouter/google/gemini-3.8-flash",
            messages=[Message(role="user", content="Test prompt " * 50)],
            max_tokens=100
        )
        
        # Gemini should cost more
        assert gemini_response.actual_cost_usd > haiku_response.actual_cost_usd


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
