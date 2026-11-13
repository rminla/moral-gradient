#!/usr/bin/env python3
"""Calibration guard: validate that preregistered studies use correct v3final calibrated levels.

The preregistered studies (S1 and S2) must use the car_si hardship levels that were
calibrated in v3final for each model. This guard reads the frozen v3final calibration
and validates that:
1. The calibration file exists for each model
2. The car_si levels are within the valid range
3. The studies use the calibrated levels

Usage:
    from v3.calibration_guard import validate_calibration, get_car_si_levels
    
    # Get car_si levels for a model
    levels = get_car_si_levels("claude-haiku-5.5")
    
    # Validate before running a study
    validate_calibration("claude-haiku-5.5", check_exists=True)
"""
import json
from pathlib import Path
from typing import Dict, List, Optional


def get_v3final_calibration_path(model: str, root: Optional[Path] = None) -> Path:
    """Get path to frozen v3final calibration file for a model."""
    if root is None:
        root = Path(__file__).resolve().parent.parent.parent
    return root / "data" / model / "calibration.json"


def load_v3final_calibration(model: str, root: Optional[Path] = None) -> Dict:
    """Load frozen v3final calibration for a model.
    
    Args:
        model: Model name (e.g., "claude-haiku-5.5", "gpt-oss-120b")
        root: Optional root directory (defaults to research/v3final/)
    
    Returns:
        Calibration dictionary with car_si, fb_press, etc.
    
    Raises:
        FileNotFoundError: If calibration file doesn't exist
        ValueError: If calibration file is invalid
    """
    cal_path = get_v3final_calibration_path(model, root)
    
    if not cal_path.exists():
        raise FileNotFoundError(
            f"v3final calibration not found for {model} at {cal_path}. "
            "Make sure the frozen v3final package is properly vendored."
        )
    
    try:
        with open(cal_path) as f:
            cal = json.load(f)
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON in calibration file {cal_path}: {e}")
    
    # Validate structure
    if "car_si" not in cal:
        raise ValueError(f"Calibration file {cal_path} missing 'car_si' key")
    if "levels" not in cal["car_si"]:
        raise ValueError(f"Calibration file {cal_path} missing 'car_si.levels' key")
    
    return cal


def get_car_si_levels(model: str, root: Optional[Path] = None) -> List[int]:
    """Get the calibrated car_si hardship levels for a model.
    
    Args:
        model: Model name (e.g., "claude-haiku-5.5", "gpt-oss-120b")
        root: Optional root directory (defaults to research/v3final/)
    
    Returns:
        List of calibrated hardship levels (e.g., [4, 5])
    
    Raises:
        FileNotFoundError: If calibration file doesn't exist
        ValueError: If calibration is invalid
    """
    cal = load_v3final_calibration(model, root)
    levels = cal["car_si"]["levels"]
    
    if not isinstance(levels, list) or len(levels) == 0:
        raise ValueError(f"Invalid car_si levels for {model}: {levels}")
    
    if not all(isinstance(L, int) and 1 <= L <= 8 for L in levels):
        raise ValueError(f"car_si levels out of range [1,8] for {model}: {levels}")
    
    return levels


def validate_calibration(
    model: str,
    root: Optional[Path] = None,
    check_exists: bool = True,
    check_car_si: bool = True
) -> Dict:
    """Validate v3final calibration for a model.
    
    Args:
        model: Model name (e.g., "claude-haiku-5.5", "gpt-oss-120b")
        root: Optional root directory (defaults to research/v3final/)
        check_exists: If True, verify calibration file exists
        check_car_si: If True, verify car_si levels are valid
    
    Returns:
        Calibration dictionary if validation passes
    
    Raises:
        FileNotFoundError: If calibration file doesn't exist (when check_exists=True)
        ValueError: If calibration is invalid
    """
    if check_exists:
        cal_path = get_v3final_calibration_path(model, root)
        if not cal_path.exists():
            raise FileNotFoundError(
                f"v3final calibration not found for {model} at {cal_path}"
            )
    
    cal = load_v3final_calibration(model, root)
    
    if check_car_si:
        levels = cal["car_si"]["levels"]
        if not levels or len(levels) == 0:
            raise ValueError(f"No car_si levels calibrated for {model}")
        
        # Verify levels are in valid range
        if not all(isinstance(L, int) and 1 <= L <= 8 for L in levels):
            raise ValueError(f"car_si levels out of range [1,8] for {model}: {levels}")
        
        # Check tipping point exists and is valid
        if "tipping" in cal["car_si"]:
            tip = cal["car_si"]["tipping"]
            if tip.get("valid"):
                est = tip.get("est")
                if est is not None and not (0 <= est <= 9):
                    raise ValueError(f"Invalid tipping point estimate for {model}: {est}")
    
    return cal


def validate_all_models(
    models: Optional[List[str]] = None,
    root: Optional[Path] = None
) -> Dict[str, Dict]:
    """Validate v3final calibration for all models.
    
    Args:
        models: List of model names (defaults to v3final standard models)
        root: Optional root directory (defaults to research/v3final/)
    
    Returns:
        Dictionary mapping model names to their calibrations
    
    Raises:
        FileNotFoundError: If any calibration file is missing
        ValueError: If any calibration is invalid
    """
    if models is None:
        models = ["claude-haiku-5.5", "gpt-oss-120b", "qwen3.6-27b", "gemini-3.8-flash"]
    
    calibrations = {}
    errors = []
    
    for model in models:
        try:
            cal = validate_calibration(model, root, check_exists=True, check_car_si=True)
            calibrations[model] = cal
        except (FileNotFoundError, ValueError) as e:
            errors.append(f"{model}: {e}")
    
    if errors:
        raise ValueError(f"Calibration validation failed:\n" + "\n".join(errors))
    
    return calibrations


def print_calibration_summary(models: Optional[List[str]] = None, root: Optional[Path] = None):
    """Print summary of v3final calibrations for all models."""
    if models is None:
        models = ["claude-haiku-5.5", "gpt-oss-120b", "qwen3.6-27b", "gemini-3.8-flash"]
    
    print("=" * 70)
    print("V3FINAL CALIBRATION SUMMARY")
    print("=" * 70)
    print()
    
    for model in models:
        try:
            cal = load_v3final_calibration(model, root)
            levels = cal["car_si"]["levels"]
            tip = cal["car_si"]["tipping"]
            obs_p = cal["car_si"].get("observed_p", "N/A")
            flag = cal["car_si"].get("flag") or "none"
            
            print(f"Model: {model}")
            print(f"  car_si levels: {levels}")
            print(f"  Tipping point: {tip.get('est', 'N/A'):.2f} [{tip.get('lo', 'N/A'):.2f}, {tip.get('hi', 'N/A'):.2f}]" if tip.get("valid") else f"  Tipping point: {tip.get('side', 'N/A')}")
            print(f"  Observed P(act): {obs_p}")
            print(f"  Flag: {flag}")
            print()
        except Exception as e:
            print(f"Model: {model}")
            print(f"  ERROR: {e}")
            print()


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] in ["--help", "-h"]:
        print("Usage: python calibration_guard.py [--validate]")
        print()
        print("Options:")
        print("  --validate    Validate all calibrations and exit with status code")
        print("  (no args)     Print calibration summary")
        sys.exit(0)
    
    if len(sys.argv) > 1 and sys.argv[1] == "--validate":
        try:
            validate_all_models()
            print("✓ All calibrations valid")
            sys.exit(0)
        except Exception as e:
            print(f"✗ Validation failed: {e}", file=sys.stderr)
            sys.exit(1)
    else:
        print_calibration_summary()
