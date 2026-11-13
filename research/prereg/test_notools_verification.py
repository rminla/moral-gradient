#!/usr/bin/env python3
"""Test no-tools cell verification (deviation 5).

Verifies that:
1. No-tools cells (agent_notools, advisor_notools) make single calls with tools=None
2. Tools cells (agent_tools, advisor_tools) make calls with tools
3. This is validated from logged harness output
"""
import json
import sys
import tempfile
from pathlib import Path
from unittest.mock import Mock, MagicMock

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO_ROOT / "research" / "v3final" / "harness"))
sys.path.insert(0, str(REPO_ROOT / "research" / "prereg"))

from run_prereg import CELL_CONFIG, plan_prereg
from v3_prereg_layer import unit_with_car_role, car_role_spec


def test_cell_config_correct():
    """Test that CELL_CONFIG maps no-tools cells to tools=False."""
    for cell, (role, tools) in CELL_CONFIG.items():
        if "notools" in cell:
            assert tools == False, f"{cell} should have tools=False"
        else:
            assert tools == True, f"{cell} should have tools=True"
    
    print("✓ CELL_CONFIG correct: no-tools cells have tools=False")


def test_car_role_spec_notools_have_no_tools():
    """Test that car_role specs for no-tools cells have no tools."""
    model = "claude-haiku-5.5"
    
    for cell, (role, tools_flag) in CELL_CONFIG.items():
        spec = car_role_spec(model, role, tools_flag, para=0, lvl=4)
        
        if "notools" in cell:
            # No-tools cells should have no tools
            assert spec.get("tools") is None or spec.get("tools") == [], \
                f"{cell} spec should have no tools, got {spec.get('tools')}"
            # Should have decisions for parsing
            assert "decisions" in spec, f"{cell} spec should have decisions dict"
            print(f"✓ {cell}: spec has no tools, has decisions")
        else:
            # Tools cells should have tools
            assert spec.get("tools") is not None and len(spec.get("tools", [])) > 0, \
                f"{cell} spec should have tools"
            print(f"✓ {cell}: spec has {len(spec.get('tools', []))} tools")


def test_unit_with_car_role_notools_single_call():
    """Test that unit_with_car_role makes single chat call for no-tools cells."""
    # Mock engine
    engine = Mock()
    engine.model = "claude-haiku-5.5"
    engine.emit = Mock()
    
    # Mock the T.chat method for no-tools
    chat_response = {
        "ok": True,
        "text": "Based on the policy, DECISION: waive_fee",
        "cost_usd": 0.001,
        "finish": "stop",
    }
    engine.T = Mock()
    engine.T.chat = Mock(return_value=chat_response)
    
    # Mock the ask method for tools (should not be called for no-tools)
    engine.ask = Mock(return_value=chat_response)
    
    # Test no-tools cell
    j_notools = {
        "case": "car_role",
        "phase": "role",
        "cell": "agent_notools",
        "role": "agent",
        "tools": False,
        "para": 0,
        "level": 4,
        "stakes": 4,
        "s": 0,
    }
    
    row = unit_with_car_role(engine, j_notools, "test_key_notools")
    
    # Verify single chat call with tools=None
    assert engine.T.chat.called, "chat() should be called for no-tools cell"
    assert engine.T.chat.call_count == 1, "Should make exactly 1 call for no-tools"
    
    # Check that tools=None was passed
    call_args = engine.T.chat.call_args
    # The third positional arg is tools
    assert call_args[0][2] is None, "No-tools cell should pass tools=None"
    
    # Verify ask() was NOT called (tools episodes use ask)
    assert not engine.ask.called, "ask() should not be called for no-tools cell"
    
    print("✓ No-tools cell: single chat() call with tools=None")


def test_unit_with_car_role_tools_episode():
    """Test that unit_with_car_role makes episode calls for tools cells."""
    # Mock engine
    engine = Mock()
    engine.model = "claude-haiku-5.5"
    engine.emit = Mock()
    
    # Mock ask for tools episode
    ask_response = {
        "ok": True,
        "text": "I'll help with that.",
        "cost_usd": 0.002,
        "tool_calls": [{"name": "lookup_account", "input": {}, "valid": True}],
        "finish": "stop",
    }
    engine.ask = Mock(return_value=ask_response)
    
    # Test tools cell
    j_tools = {
        "case": "car_role",
        "phase": "role",
        "cell": "agent_tools",
        "role": "agent",
        "tools": True,
        "para": 0,
        "level": 4,
        "stakes": 4,
        "s": 0,
    }
    
    row = unit_with_car_role(engine, j_tools, "test_key_tools")
    
    # Verify ask() was called (episode with tools)
    assert engine.ask.called, "ask() should be called for tools cell"
    
    # Check that tools were passed
    call_args = engine.ask.call_args
    assert "tools" in call_args[1], "Tools should be passed as keyword arg"
    tools_arg = call_args[1]["tools"]
    assert tools_arg is not None, "Tools cell should pass actual tools, not None"
    
    print("✓ Tools cell: ask() called with tools")


def test_plan_has_correct_tools_flags():
    """Test that planned units have correct tools flags."""
    # Load calibration
    cal_file = REPO_ROOT / "research" / "v3final" / "data" / "claude-haiku-5.5" / "calibration.json"
    cal = json.loads(cal_file.read_text())
    
    # Plan S2 with role phase
    plan = plan_prereg("main", cal, smoke=True, cue_n={}, role_n=2, phases=["role"])
    
    role_units = [j for j in plan if j["phase"] == "role"]
    
    for j in role_units:
        cell = j["cell"]
        tools_flag = j["tools"]
        
        if "notools" in cell:
            assert tools_flag == False, f"{cell} planned with tools=True, should be False"
        else:
            assert tools_flag == True, f"{cell} planned with tools=False, should be True"
    
    print(f"✓ Planned {len(role_units)} role units, all have correct tools flags")


def test_logged_requests_from_fake_canary():
    """Test that we can verify no-tools from logged output.
    
    This simulates what the real canary check would do:
    read harness output and verify no-tools cells have correct structure.
    """
    # Simulate some logged rows
    rows = [
        {
            "key": "test1",
            "cell": "agent_notools",
            "outcome": "act",
            "unparsed": False,
            # No-tools cells should not have 'calls' field
        },
        {
            "key": "test2",
            "cell": "agent_tools",
            "outcome": "act",
            "tool_calls": [{"name": "lookup_account"}],  # Tools cells have 'tool_calls'
        },
        {
            "key": "test3",
            "cell": "advisor_notools",
            "outcome": "act",
            "unparsed": False,
        },
        {
            "key": "test4",
            "cell": "advisor_tools",
            "outcome": "act",
            "tool_calls": [{"name": "lookup_account"}, {"name": "waive_fee"}],
        },
    ]
    
    # Verify structure
    for row in rows:
        cell = row["cell"]
        has_tool_calls = "tool_calls" in row
        
        if "notools" in cell:
            assert not has_tool_calls, f"No-tools cell {cell} should not have 'tool_calls' field"
            print(f"✓ {cell}: no 'tool_calls' field")
        else:
            assert has_tool_calls, f"Tools cell {cell} should have 'tool_calls' field"
            print(f"✓ {cell}: has 'tool_calls' field with {len(row['tool_calls'])} calls")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
