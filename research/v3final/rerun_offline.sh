#!/bin/bash
# Re-run the v3final analysis offline from the published records. No API calls, no keys needed.
# Usage: bash rerun_offline.sh [workdir]   (default: ./_rerun)
# Requires Python 3.11+ with numpy, scipy, matplotlib, requests (requests is imported but never called offline).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
W="${1:-$HERE/_rerun}"
rm -rf "$W"; mkdir -p "$W"
cp -R "$HERE/harness/." "$W/"
for m in claude-haiku-5.5 gpt-oss-120b qwen3.6-27b gemini-3.8-flash; do
  d="$W/data/v3/v3final/$m"; mkdir -p "$d"
  cp "$HERE/data/$m/records.jsonl" "$d/main.jsonl"
  cp "$HERE/data/$m/calibrate.jsonl" "$d/calibrate.jsonl"
  cp "$HERE/data/$m/calibration.json" "$d/calibration.json"
  cp "$HERE/data/$m/trace_codes.jsonl" "$d/traces.jsonl"
  # Optional: the sanitized call logs (separate download, see README). With them, cost_usd and one trace-coverage counter also match.
  if [ -f "$HERE/calls/$m/calls.jsonl.gz" ]; then
    gunzip -c "$HERE/calls/$m/calls.jsonl.gz" > "$d/calls.jsonl"
    gunzip -c "$HERE/calls/$m/trace_calls.jsonl.gz" > "$d/trace_calls.jsonl"
  fi
done
cd "$W"
env -u ANTHROPIC_API_KEY -u GROQ_API_KEY -u OPENROUTER_API_KEY python3 v3/analyze.py v3final claude-haiku-5.5 gpt-oss-120b qwen3.6-27b gemini-3.8-flash
env -u ANTHROPIC_API_KEY -u GROQ_API_KEY -u OPENROUTER_API_KEY TRACES_OUT=v3/out/v3final/traces python3 v3/traces.py analyze v3final
python3 "$HERE/reproduce/compare_bundles.py" "$HERE/aggregates/bundle.json" "$W/v3/out/v3final/bundle.json"
