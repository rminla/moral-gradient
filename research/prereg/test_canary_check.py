"""Tests for canary_check.py gate validation.

Tests that good mocks pass and bad mocks (tools in no-tools cells) fail gate (a).

Run: python3 -m pytest test_canary_check.py -v
"""
import json
import sqlite3
import tempfile
from pathlib import Path

import pytest


def create_mock_ledger_with_calls(calls_data: list) -> Path:
    """Create a mock ledger database with call logs."""
    temp_db = tempfile.NamedTemporaryFile(delete=False, suffix='.db')
    conn = sqlite3.connect(temp_db.name)
    cursor = conn.cursor()
    
    # Create calls table
    cursor.execute("""
        CREATE TABLE calls (
            key TEXT PRIMARY KEY,
            request TEXT,
            response TEXT,
            cost_usd REAL,
            error TEXT
        )
    """)
    
    for call in calls_data:
        cursor.execute("""
            INSERT INTO calls (key, request, response, cost_usd, error)
            VALUES (?, ?, ?, ?, ?)
        """, (
            call["key"],
            json.dumps(call["request"]),
            json.dumps(call.get("response", {})),
            call.get("cost", 0.01),
            call.get("error"),
        ))
    
    conn.commit()
    conn.close()
    
    return Path(temp_db.name)


def create_mock_prompts_json() -> Path:
    """Create a mock prompts JSON for Study 2."""
    prompts = {
        "specs": [
            {
                "model": "test-model",
                "cell": "agent_tools",
                "para": 0,
                "level": 1,
                "system": "You are an agent with tools.",
                "user": "Handle this request.",
                "tools": [
                    {"name": "lookup_account", "description": "Look up account"}
                ],
            },
            {
                "model": "test-model",
                "cell": "agent_notools",
                "para": 0,
                "level": 1,
                "system": "You are an agent without tools.",
                "user": "Handle this request.",
                "tools": None,
            },
        ]
    }
    
    temp_file = tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.json')
    json.dump(prompts, temp_file)
    temp_file.close()
    
    return Path(temp_file.name)


def test_gate_a_passes_with_good_mock():
    """Test that gate (a) passes when requests match specs."""
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from canary_check import gate_a_validation, load_prompts_json
    
    # Create good calls (tools only in agent_tools)
    calls = [
        {
            "key": "data/v3/prereg_s2/test-model/main/car_role_do_1_agent_tools_0.jsonl",
            "request": {
                "messages": [
                    {"role": "system", "content": "You are an agent with tools."},
                    {"role": "user", "content": "Handle this request."},
                ],
                "tools": [
                    {"name": "lookup_account", "description": "Look up account"}
                ],
            },
        },
        {
            "key": "data/v3/prereg_s2/test-model/main/car_role_do_1_agent_notools_0.jsonl",
            "request": {
                "messages": [
                    {"role": "system", "content": "You are an agent without tools."},
                    {"role": "user", "content": "Handle this request."},
                ],
                "tools": None,
            },
        },
    ]
    
    prompts_path = create_mock_prompts_json()
    
    try:
        prompts_data = load_prompts_json(prompts_path)
        passed, errors = gate_a_validation(calls, prompts_data, "s2")
        
        assert passed, f"Gate (a) should pass but got errors: {errors}"
        assert len(errors) == 0, f"No errors expected but got: {errors}"
        
        print("✓ Good mock passes gate (a)")
    
    finally:
        prompts_path.unlink()


def test_gate_a_fails_with_bad_tool_mock():
    """Test that gate (a) FAILS when tools are called in no-tools cells."""
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from canary_check import gate_a_validation, load_prompts_json
    
    # Create bad calls (tools in agent_notools cell)
    calls = [
        {
            "key": "data/v3/prereg_s2/test-model/main/car_role_do_1_agent_tools_0.jsonl",
            "request": {
                "messages": [
                    {"role": "system", "content": "You are an agent with tools."},
                    {"role": "user", "content": "Handle this request."},
                ],
                "tools": [
                    {"name": "lookup_account", "description": "Look up account"}
                ],
            },
        },
        {
            "key": "data/v3/prereg_s2/test-model/main/car_role_do_1_agent_notools_0.jsonl",
            "request": {
                "messages": [
                    {"role": "system", "content": "You are an agent without tools."},
                    {"role": "user", "content": "Handle this request."},
                ],
                # BAD: tools provided in notools cell
                "tools": [
                    {"name": "lookup_account", "description": "Look up account"}
                ],
            },
        },
    ]
    
    prompts_path = create_mock_prompts_json()
    
    try:
        prompts_data = load_prompts_json(prompts_path)
        passed, errors = gate_a_validation(calls, prompts_data, "s2")
        
        assert not passed, "Gate (a) should FAIL with tools in no-tools cell"
        assert len(errors) > 0, "Should have errors for bad tool mock"
        
        # Check that the error mentions tool mismatch
        error_text = " ".join(errors)
        assert "tool" in error_text.lower() or "mismatch" in error_text.lower(), \
            f"Error should mention tool issue: {errors}"
        
        print("✓ Bad tool mock FAILS gate (a) as expected")
        print(f"  Errors: {errors}")
    
    finally:
        prompts_path.unlink()


def test_gate_b_error_rate():
    """Test gate (b): ≥95% success rate."""
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from canary_check import gate_b_validation
    
    # Create data with 96% success (should pass)
    data_pass = [{"outcome": "keep", "error": None} for _ in range(96)]
    data_pass += [{"outcome": "keep", "error": "timeout"} for _ in range(4)]
    
    temp_pass = tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.jsonl')
    for rec in data_pass:
        temp_pass.write(json.dumps(rec) + '\n')
    temp_pass.close()
    
    try:
        passed, rate, msg = gate_b_validation(Path(temp_pass.name))
        assert passed, f"96% success should pass gate (b): {msg}"
        assert rate >= 0.95, f"Rate {rate} should be >= 0.95"
        
        print(f"✓ Gate (b) passes with 96% success: {msg}")
    
    finally:
        Path(temp_pass.name).unlink()
    
    # Create data with 94% success (should fail)
    data_fail = [{"outcome": "keep", "error": None} for _ in range(94)]
    data_fail += [{"outcome": "keep", "error": "timeout"} for _ in range(6)]
    
    temp_fail = tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.jsonl')
    for rec in data_fail:
        temp_fail.write(json.dumps(rec) + '\n')
    temp_fail.close()
    
    try:
        passed, rate, msg = gate_b_validation(Path(temp_fail.name))
        assert not passed, f"94% success should fail gate (b): {msg}"
        assert rate < 0.95, f"Rate {rate} should be < 0.95"
        
        print(f"✓ Gate (b) fails with 94% success: {msg}")
    
    finally:
        Path(temp_fail.name).unlink()


def test_gate_c_unparsed_in_notools():
    """Test gate (c): S2 unparsed ≤10% in no-tools cells."""
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from canary_check import gate_c_validation_s2
    
    # Create data with 9% unparsed in notools (should pass)
    data_pass = []
    for i in range(100):
        data_pass.append({
            "model": "m1",
            "cell": "agent_notools",
            "unparsed": i >= 91,  # 9% unparsed
        })
    
    temp_pass = tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.jsonl')
    for rec in data_pass:
        temp_pass.write(json.dumps(rec) + '\n')
    temp_pass.close()
    
    try:
        passed, stats, msg = gate_c_validation_s2(Path(temp_pass.name))
        assert passed, f"9% unparsed should pass gate (c): {msg}"
        
        print(f"✓ Gate (c) passes with 9% unparsed: {msg}")
    
    finally:
        Path(temp_pass.name).unlink()
    
    # Create data with 15% unparsed (should fail)
    data_fail = []
    for i in range(100):
        data_fail.append({
            "model": "m1",
            "cell": "agent_notools",
            "unparsed": i >= 85,  # 15% unparsed
        })
    
    temp_fail = tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.jsonl')
    for rec in data_fail:
        temp_fail.write(json.dumps(rec) + '\n')
    temp_fail.close()
    
    try:
        passed, stats, msg = gate_c_validation_s2(Path(temp_fail.name))
        assert not passed, f"15% unparsed should fail gate (c): {msg}"
        
        print(f"✓ Gate (c) fails with 15% unparsed: {msg}")
    
    finally:
        Path(temp_fail.name).unlink()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
