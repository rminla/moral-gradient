#!/usr/bin/env python3
"""Regression test for pricing unit conversion (per-million vs per-token)."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from lib.models import estimate_cost, MODELS


def test_pricing_units():
    """
    Verify prices are per-million tokens, not per-token.
    
    Example: Haiku $0.10 per 1M input tokens
    - 1000 input tokens should cost: 1000 / 1,000,000 * 0.10 = $0.0001
    - NOT: 1000 * 0.10 = $100 (1000x too high)
    """
    print("Testing pricing unit conversion...")
    
    # Haiku: $0.10 input, $0.50 output per 1M tokens
    cost = estimate_cost(
        "anthropic/claude-haiku-5-5",
        input_tokens=1000,
        output_tokens=500
    )
    
    # Expected: (1000/1M * 0.10) + (500/1M * 0.50) = 0.0001 + 0.00025 = 0.00035
    expected = (1000 / 1_000_000 * 0.10) + (500 / 1_000_000 * 0.50)
    
    print(f"  1000 input + 500 output tokens")
    print(f"  Calculated: ${cost:.6f}")
    print(f"  Expected: ${expected:.6f}")
    
    assert abs(cost - expected) < 0.000001, f"Cost {cost} != expected {expected}"
    assert cost < 0.001, f"Cost ${cost:.6f} suspiciously high (pricing 1000x error?)"
    
    print(f"  ✓ Pricing correct (per-million, not per-token)")
    
    # Test all models
    for model_id in MODELS.keys():
        cost = estimate_cost(model_id, 1000, 500)
        assert cost < 0.01, f"{model_id}: ${cost:.6f} too high for 1500 tokens"
        print(f"  ✓ {model_id}: ${cost:.6f} (reasonable)")
    
    return True


def test_worst_case_estimate():
    """Test worst-case estimation with 3x multiplier."""
    from lib.models import get_worst_case_estimate
    
    print("\nTesting worst-case estimates...")
    
    # Haiku worst-case for 1000 prompt tokens, 1024 max output
    worst = get_worst_case_estimate("anthropic/claude-haiku-5-5", 1000, 1024)
    
    # Expected: ((1000 + 1024) / 1M * avg_price) * 3x
    # avg_price ≈ (0.10 + 0.50) / 2 = 0.30
    # But actual uses input/output separately: (1000/1M*0.10 + 1024/1M*0.50) * 3
    actual_base = (1000 / 1_000_000 * 0.10) + (1024 / 1_000_000 * 0.50)
    expected_worst = actual_base * 3
    
    print(f"  Worst-case for 1000 prompt + 1024 max output:")
    print(f"  Calculated: ${worst:.6f}")
    print(f"  Expected: ${expected_worst:.6f}")
    
    assert worst < 0.01, f"Worst-case ${worst:.6f} too high"
    assert abs(worst - expected_worst) < 0.001, f"Worst-case calculation off"
    
    print(f"  ✓ Worst-case estimation correct")
    
    return True


if __name__ == "__main__":
    try:
        test_pricing_units()
        test_worst_case_estimate()
        print("\n✓ All pricing regression tests PASSED")
        sys.exit(0)
    except Exception as e:
        print(f"\n✗ Pricing test FAILED: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
