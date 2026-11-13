#!/usr/bin/env python3
"""Test that prompts SHA256 verification works correctly."""
import json
import sys
import tempfile
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO_ROOT / "research" / "prereg"))

from v3_prereg_layer import (
    S1_PROMPTS_PATH,
    S1_PROMPTS_SHA256,
    S2_PROMPTS_PATH,
    S2_PROMPTS_SHA256,
    verify_prompts_sha256,
    car_role_spec,
)


def test_s1_prompts_sha256_matches():
    """Test that Study 1 prompts have correct SHA256."""
    prompts = verify_prompts_sha256(S1_PROMPTS_PATH, S1_PROMPTS_SHA256, "Study 1")
    assert isinstance(prompts, dict)
    assert len(prompts) > 0
    print(f"✓ Study 1 prompts verified: {len(prompts)} specs")


def test_s2_prompts_sha256_matches():
    """Test that Study 2 prompts have correct SHA256."""
    prompts = verify_prompts_sha256(S2_PROMPTS_PATH, S2_PROMPTS_SHA256, "Study 2")
    assert isinstance(prompts, dict)
    assert len(prompts) > 0
    print(f"✓ Study 2 prompts verified: {len(prompts)} specs")


def test_s2_prompts_sha256_fails_on_mismatch():
    """Test that SHA256 verification fails when prompts are modified."""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
        # Write modified content
        json.dump({"modified": "content"}, f)
        temp_path = Path(f.name)
    
    try:
        with pytest.raises(ValueError, match="SHA256 mismatch"):
            verify_prompts_sha256(temp_path, S2_PROMPTS_SHA256, "Test")
        print("✓ SHA256 verification correctly rejects modified prompts")
    finally:
        temp_path.unlink()


def test_car_role_spec_verifies_sha256():
    """Test that car_role_spec verifies SHA256 at load time."""
    # Should succeed with correct SHA256
    spec = car_role_spec("claude-haiku-5.5", "agent", True, 0, 4)
    assert "system" in spec
    assert "user" in spec
    assert "tools" in spec
    assert "decisions" in spec
    print("✓ car_role_spec loads and verifies SHA256")


def test_s1_prompts_file_exists():
    """Test that Study 1 prompts file exists."""
    assert S1_PROMPTS_PATH.exists(), f"Study 1 prompts not found: {S1_PROMPTS_PATH}"
    print(f"✓ Study 1 prompts file exists: {S1_PROMPTS_PATH}")


def test_s2_prompts_file_exists():
    """Test that Study 2 prompts file exists."""
    assert S2_PROMPTS_PATH.exists(), f"Study 2 prompts not found: {S2_PROMPTS_PATH}"
    print(f"✓ Study 2 prompts file exists: {S2_PROMPTS_PATH}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
