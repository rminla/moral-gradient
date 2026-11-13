"""Record package and environment versions for reproducibility"""

import json
import subprocess
import sys
from datetime import datetime
from pathlib import Path


def get_git_info() -> dict:
    """Get current git commit and status"""
    try:
        commit = subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip()
        dirty = subprocess.call(["git", "diff-index", "--quiet", "HEAD"]) != 0
        branch = subprocess.check_output(["git", "rev-parse", "--abbrev-ref", "HEAD"], text=True).strip()
        
        return {
            "commit": commit,
            "branch": branch,
            "dirty": dirty,
        }
    except Exception as e:
        return {"error": str(e)}


def get_python_info() -> dict:
    """Get Python version and environment info"""
    return {
        "version": sys.version,
        "executable": sys.executable,
    }


def get_package_versions() -> dict:
    """Get installed package versions"""
    try:
        import pandas
        import numpy
        import scipy
        import statsmodels
        
        return {
            "pandas": pandas.__version__,
            "numpy": numpy.__version__,
            "scipy": scipy.__version__,
            "statsmodels": statsmodels.__version__,
        }
    except ImportError as e:
        return {"error": str(e)}


def main():
    if len(sys.argv) < 2:
        print("Usage: python record_versions.py <iter>")
        sys.exit(1)
    
    iter_name = sys.argv[1]
    output_dir = Path(f"output/{iter_name}")
    output_dir.mkdir(parents=True, exist_ok=True)
    
    versions = {
        "timestamp": datetime.utcnow().isoformat(),
        "iter": iter_name,
        "git": get_git_info(),
        "python": get_python_info(),
        "packages": get_package_versions(),
    }
    
    output_path = output_dir / "versions.json"
    with open(output_path, "w") as f:
        json.dump(versions, f, indent=2)
    
    print(f"Recorded versions to {output_path}")


if __name__ == "__main__":
    main()
