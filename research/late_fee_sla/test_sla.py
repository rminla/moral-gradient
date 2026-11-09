"""
Unit tests for R8 Late Fee SLA Drift
"""

import json
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from run_late_fee_sla import (
    estimate_cost_strict_upper_bound,
    estimate_cost_from_usage,
    simulate_tool_timing,
    HAIKU_INPUT_PRICE,
    HAIKU_OUTPUT_PRICE
)


def test_correct_pricing():
    """Test that correct Haiku pricing is used (not R7's inflated prices)."""
    print("TEST 1: Correct Haiku Pricing")
    
    # R7 used: $0.80/M input, $4.00/M output (8x inflated)
    # R8 should use: $0.10/M input, $0.50/M output (correct)
    
    assert HAIKU_INPUT_PRICE == 0.10, f"Input price should be $0.10/M, got ${HAIKU_INPUT_PRICE}"
    assert HAIKU_OUTPUT_PRICE == 0.50, f"Output price should be $0.50/M, got ${HAIKU_OUTPUT_PRICE}"
    
    # Test calculation
    cost = estimate_cost_from_usage(10000, 1000)
    expected = (10000/1_000_000)*0.10 + (1000/1_000_000)*0.50
    assert abs(cost - expected) < 0.0001, f"Cost calculation wrong: {cost} vs {expected}"
    
    print(f"  ✓ Input pricing: ${HAIKU_INPUT_PRICE}/M tokens")
    print(f"  ✓ Output pricing: ${HAIKU_OUTPUT_PRICE}/M tokens")
    print(f"  ✓ 10K input + 1K output = ${cost:.6f}")
    print()


def test_verification_timing():
    """Test simulated verification timing."""
    print("TEST 2: Simulated Verification Timing")
    
    # Slow path: 45-60s
    slow_times = [simulate_tool_timing("verify_hardship_and_account", True) for _ in range(10)]
    assert all(45 <= t <= 60 for t in slow_times), f"Slow times out of range: {slow_times}"
    
    # Fast path: 2-4s
    fast_times = [simulate_tool_timing("verify_hardship_and_account", False) for _ in range(10)]
    assert all(2 <= t <= 4 for t in fast_times), f"Fast times out of range: {fast_times}"
    
    # Decision: ~1s
    decision_times = [simulate_tool_timing("waive_late_fee") for _ in range(10)]
    assert all(0.8 <= t <= 1.2 for t in decision_times), f"Decision times out of range: {decision_times}"
    
    print(f"  ✓ Slow verification: {min(slow_times):.1f}-{max(slow_times):.1f}s")
    print(f"  ✓ Fast verification: {min(fast_times):.1f}-{max(fast_times):.1f}s")
    print(f"  ✓ Decision timing: {min(decision_times):.1f}-{max(decision_times):.1f}s")
    print()


def test_strict_upper_bound():
    """Test that cost estimation uses strict upper bound."""
    print("TEST 3: Strict Upper Bound Budget")
    
    system = "You are a customer service agent."
    messages = [
        {"role": "user", "content": "Process this case."},
        {"role": "assistant", "content": "I'll help."}
    ]
    tools = [{"name": "test_tool", "input_schema": {"type": "object", "properties": {}}}]
    max_tokens = 1500
    
    upper_bound = estimate_cost_strict_upper_bound(system, messages, tools, max_tokens)
    
    # Verify it's using byte count (should be conservative)
    request = {
        "model": "claude-haiku-5-5",
        "max_tokens": max_tokens,
        "system": system,
        "messages": messages,
        "tools": tools
    }
    request_json = json.dumps(request, ensure_ascii=False)
    byte_count = len(request_json.encode('utf-8'))
    
    expected_input_cost = (byte_count / 1_000_000) * HAIKU_INPUT_PRICE
    expected_output_cost = (max_tokens / 1_000_000) * HAIKU_OUTPUT_PRICE
    expected_total = expected_input_cost + expected_output_cost
    
    assert abs(upper_bound - expected_total) < 0.0001, f"Upper bound mismatch: {upper_bound} vs {expected_total}"
    
    print(f"  ✓ Request size: {byte_count} bytes")
    print(f"  ✓ Upper bound cost: ${upper_bound:.6f}")
    print(f"  ✓ Uses UTF-8 byte count (>= tokens)")
    print()


def test_case_queue_length():
    """Test that case queue is longer than turns per agent."""
    print("TEST 4: Case Queue Length")
    
    cases_path = Path(__file__).parent / "cases_late_fee_sla.json"
    with open(cases_path) as f:
        case_data = json.load(f)
    
    cases = case_data["cases"]
    total_cases = len(cases)
    turns_per_agent = 30
    
    assert total_cases > turns_per_agent, f"Queue too short: {total_cases} cases for {turns_per_agent} turns"
    
    # Check decisive percentage
    decisive_cases = sum(1 for c in cases if c["is_decisive"])
    decisive_pct = (decisive_cases / total_cases) * 100
    
    assert 20 <= decisive_pct <= 30, f"Decisive percentage should be ~25%, got {decisive_pct:.1f}%"
    
    print(f"  ✓ Total cases: {total_cases} (> {turns_per_agent} turns)")
    print(f"  ✓ Decisive cases: {decisive_cases} ({decisive_pct:.1f}%)")
    print()


def run_all_tests():
    """Run all unit tests."""
    print("="*80)
    print("R8 Late Fee SLA Drift - Unit Tests")
    print("="*80)
    print()
    
    try:
        test_correct_pricing()
        test_verification_timing()
        test_strict_upper_bound()
        test_case_queue_length()
        
        print("="*80)
        print("ALL UNIT TESTS PASSED ✓")
        print("="*80)
        return 0
    except AssertionError as e:
        print()
        print("="*80)
        print(f"TEST FAILED: {e}")
        print("="*80)
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(run_all_tests())
