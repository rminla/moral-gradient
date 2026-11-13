#!/usr/bin/env python3
"""Generate canary evidence."""
import json
from pathlib import Path
from collections import defaultdict

def main():
    Path("research/prereg/evidence").mkdir(parents=True, exist_ok=True)
    
    # S1
    s1_data = []
    for model in ['claude-haiku-5.5', 'gpt-oss-120b', 'qwen3.6-27b', 'gemini-3.8-flash']:
        path = Path(f'research/v3final/harness/run_s1_canary_fake_main/data/v3/s1_canary_fake/{model}/main.jsonl')
        if path.exists():
            with open(path) as f:
                for line in f:
                    s1_data.append(json.loads(line))
    
    s1_by_model = defaultdict(int)
    s1_by_cue = defaultdict(int)
    s1_errors = 0
    for row in s1_data:
        s1_by_model[row.get('target', 'unknown')] += 1
        cue = row.get('cue')
        if cue is None:
            cue = 'none'  # NONE arm has no cue field
        s1_by_cue[cue] = s1_by_cue.get(cue, 0) + 1
        if row.get('error'):
            s1_errors += 1
    
    print("S1 Canary:")
    print(f"  Total: {len(s1_data)}")
    print(f"  By model:")
    for model in sorted(s1_by_model.keys()):
        print(f"    {model}: {s1_by_model[model]}")
    print(f"  By cue:")
    for cue in sorted(s1_by_cue.keys()):
        print(f"    {cue}: {s1_by_cue[cue]}")
    print(f"  Errors: {s1_errors}")
    
    with open("research/prereg/evidence/s1_canary_evidence.json", "w") as f:
        json.dump({
            "total_units": len(s1_data),
            "by_model": dict(s1_by_model),
            "by_cue": dict(s1_by_cue),
            "errors": s1_errors
        }, f, indent=2)
    
    # S2
    s2_data = []
    for model in ['claude-haiku-5.5', 'gpt-oss-120b', 'qwen3.6-27b', 'gemini-3.8-flash']:
        path = Path(f'research/v3final/harness/run_s2_canary_fake_main/data/v3/s2_canary_fake/{model}/main.jsonl')
        if path.exists():
            with open(path) as f:
                for line in f:
                    s2_data.append(json.loads(line))
    
    s2_by_model = defaultdict(int)
    s2_by_cell = defaultdict(int)
    s2_errors = 0
    for row in s2_data:
        s2_by_model[row.get('target', 'unknown')] += 1
        s2_by_cell[row.get('cell', 'unknown')] += 1
        if row.get('error'):
            s2_errors += 1
    
    print("\nS2 Canary:")
    print(f"  Total: {len(s2_data)}")
    print(f"  By model:")
    for model in sorted(s2_by_model.keys()):
        print(f"    {model}: {s2_by_model[model]}")
    print(f"  By cell:")
    for cell in sorted(s2_by_cell.keys()):
        print(f"    {cell}: {s2_by_cell[cell]}")
    print(f"  Errors: {s2_errors}")
    
    with open("research/prereg/evidence/s2_canary_evidence.json", "w") as f:
        json.dump({
            "total_units": len(s2_data),
            "by_model": dict(s2_by_model),
            "by_cell": dict(s2_by_cell),
            "errors": s2_errors
        }, f, indent=2)
    
    print("\n✓ Evidence written to research/prereg/evidence/")

if __name__ == "__main__":
    main()
