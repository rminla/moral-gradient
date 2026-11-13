#!/usr/bin/env python3
"""Compare a freshly regenerated bundle.json with the archived one and list every difference.
Expected without the call logs: only the four per-model cost_usd fields (computed from calls.jsonl) and
reasoning_trace.coverage.press_trace_found_in_log for claude-haiku-5.5 (also read from calls.jsonl)."""
import json, sys
a, b = (json.load(open(p)) for p in sys.argv[1:3])
diffs = []
def walk(x, y, path):
    if isinstance(x, dict) and isinstance(y, dict):
        for k in sorted(set(x) | set(y)):
            if k not in x or k not in y: diffs.append((path + "/" + str(k), "missing on one side")); continue
            walk(x[k], y[k], path + "/" + str(k))
    elif isinstance(x, list) and isinstance(y, list):
        if len(x) != len(y): diffs.append((path, f"list length {len(x)} vs {len(y)}")); return
        for i, (u, v) in enumerate(zip(x, y)): walk(u, v, f"{path}[{i}]")
    elif isinstance(x, float) and isinstance(y, float):
        if not (x == y or (x != x and y != y) or abs(x - y) <= 1e-9 * max(1, abs(x))): diffs.append((path, f"{x} vs {y}"))
    elif x != y: diffs.append((path, f"{x!r} vs {y!r}"))
walk(a, b, "")
print(f"{len(diffs)} differences between archived and regenerated bundle")
for p, d in diffs[:50]: print(" ", p, d)
