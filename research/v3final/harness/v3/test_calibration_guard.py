"""Tests for calibration guard (fix 4).

Run: python3 -m pytest v3/test_calibration_guard.py -v
"""
import json
import tempfile
from pathlib import Path

import pytest


@pytest.fixture
def v3final_root():
    """Root of the frozen v3final package"""
    return Path(__file__).resolve().parent.parent.parent


def test_calibration_files_exist(v3final_root):
    """Test that all v3final calibration files exist"""
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from v3.calibration_guard import get_v3final_calibration_path
    
    models = ["claude-haiku-5.5", "gpt-oss-120b", "qwen3.6-27b", "gemini-3.8-flash"]
    
    for model in models:
        cal_path = get_v3final_calibration_path(model, v3final_root)
        assert cal_path.exists(), f"Calibration missing for {model} at {cal_path}"


def test_load_calibration():
    """Test loading v3final calibration"""
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from v3.calibration_guard import load_v3final_calibration
    
    cal = load_v3final_calibration("claude-haiku-5.5")
    
    assert "car_si" in cal
    assert "levels" in cal["car_si"]
    assert isinstance(cal["car_si"]["levels"], list)
    assert len(cal["car_si"]["levels"]) > 0


def test_get_car_si_levels():
    """Test getting car_si levels for each model"""
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from v3.calibration_guard import get_car_si_levels
    
    # Test all standard models
    levels = get_car_si_levels("claude-haiku-5.5")
    assert levels == [4, 5], f"Expected [4, 5], got {levels}"
    
    levels = get_car_si_levels("gpt-oss-120b")
    assert levels == [1, 2], f"Expected [1, 2], got {levels}"
    
    levels = get_car_si_levels("qwen3.6-27b")
    assert levels == [2, 3], f"Expected [2, 3], got {levels}"
    
    levels = get_car_si_levels("gemini-3.8-flash")
    assert levels == [2, 3], f"Expected [2, 3], got {levels}"


def test_validate_calibration():
    """Test calibration validation"""
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from v3.calibration_guard import validate_calibration
    
    # Should succeed for valid calibration
    cal = validate_calibration("claude-haiku-5.5", check_exists=True, check_car_si=True)
    assert cal is not None
    assert "car_si" in cal


def test_validate_all_models():
    """Test validating all models"""
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from v3.calibration_guard import validate_all_models
    
    calibrations = validate_all_models()
    
    assert len(calibrations) == 4
    assert "claude-haiku-5.5" in calibrations
    assert "gpt-oss-120b" in calibrations
    assert "qwen3.6-27b" in calibrations
    assert "gemini-3.8-flash" in calibrations


def test_calibration_structure():
    """Test that calibration has expected structure"""
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from v3.calibration_guard import load_v3final_calibration
    
    cal = load_v3final_calibration("claude-haiku-5.5")
    
    # Check required keys
    assert "car_si" in cal
    assert "rule" in cal
    assert "n_car" in cal
    
    # Check car_si structure
    car_si = cal["car_si"]
    assert "levels" in car_si
    assert "fitted_p" in car_si
    assert "tipping" in car_si
    assert "observed_p" in car_si
    
    # Check tipping point structure
    tip = car_si["tipping"]
    assert "valid" in tip
    assert "est" in tip
    assert "lo" in tip
    assert "hi" in tip


def test_invalid_calibration_missing_file():
    """Test that validation fails for missing calibration file"""
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from v3.calibration_guard import load_v3final_calibration
    
    with tempfile.TemporaryDirectory() as tmpdir:
        with pytest.raises(FileNotFoundError):
            load_v3final_calibration("nonexistent-model", root=Path(tmpdir))


def test_car_si_levels_in_range():
    """Test that all car_si levels are within valid range [1, 8]"""
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from v3.calibration_guard import get_car_si_levels
    
    models = ["claude-haiku-5.5", "gpt-oss-120b", "qwen3.6-27b", "gemini-3.8-flash"]
    
    for model in models:
        levels = get_car_si_levels(model)
        for L in levels:
            assert 1 <= L <= 8, f"{model} level {L} out of range [1, 8]"


def test_print_calibration_summary(capsys):
    """Test that calibration summary prints without errors"""
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from v3.calibration_guard import print_calibration_summary
    
    print_calibration_summary()
    
    captured = capsys.readouterr()
    assert "V3FINAL CALIBRATION SUMMARY" in captured.out
    assert "claude-haiku-5.5" in captured.out
    assert "car_si levels" in captured.out


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
