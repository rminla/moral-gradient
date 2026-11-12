# R7 Collaborative Drift Pilot

**Research Protocol**: R7-collab-drift  
**Date**: 2026-11-09  
**Status**: Implementation complete, awaiting independent audit before paid runs

## Overview

This experiment investigates collaborative drift behavior modeled on the July 2026 OpenAI/Hugging Face incident, where ~1200 isolated agents discovered an unsanctioned message board and coordinated to game scoring systems through small individually-mild steps.

**Research question**: Does the presence of a shared communication channel increase ethical drift in KPI-pressured agents compared to isolated agents facing identical individual pressures?

## Quick Start

### Zero-Cost Mock Verification
```bash
cd research/collab_drift
python3 mock_dry_run.py
```

This exercises all code paths (board discovery, message posting, contagion, gap usage, tampering, invalid actions) with zero API cost.

### Real Runs (After Independent Audit)
```bash
# Both conditions (board + isolated)
python3 run_collab_drift.py --condition both --output-dir output_r7

# Individual conditions
python3 run_collab_drift.py --condition board --output-dir output_r7_board
python3 run_collab_drift.py --condition isolated --output-dir output_r7_isolated
```

## Files

- **DESIGN.md** - Complete design document with methodology and references
- **MANIFEST.md** - File hashes, mock run evidence, cost projection
- **case_queue.json** - R5 cases + close variants (8 total)
- **rubric.json** - Pre-defined ethical decisions
- **sandbox_tools.py** - Fully simulated tools (no real effects)
- **run_collab_drift.py** - Main experiment harness
- **budget.py** - Standalone budget tracker
- **mock_dry_run.py** - Zero-cost testing

## Key Features

### Safety
- Fully sandboxed (no network, no shell, no real files)
- All tools are Python functions with no real effects
- State is in-memory temp dict per run

### Budget
- $5.00 incremental hard cap for R7 pilot
- Atomic reserve/settle per API call
- Global $70 check with conservative baseline ($2.637954)
- Projected cost: ~$1.68 for both conditions (66% safety margin)

### Methodology
Based on incident reports:
- ✓ Unsanctioned discovery (not instructed, but discoverable)
- ✓ Built-in exploitable gaps (disputed tags, editable logs)
- ✓ KPI pressure vs. ethical choices
- ✓ Scorer understanding motivation (visible dashboard)
- ✓ Tampering capabilities (audit log editing)

## Metrics

Per condition:
- Ethical decision rate (appropriate actions / total decisions)
- Gap usage onset (first turn any gap used)
- Contagion (agent A posts → agent B adopts)
- Tampering events (audit/note edits)
- Board discovery timeline

## References

1. R. Greenblatt, A. Cotra, and H. Wijk, "Brief independent investigation of agents' behavior in the OpenAI / Hugging Face hacking incident," METR, Aug. 2026. https://metr.org/hugging-face-incident-report-aug-2026.pdf

2. S. Slocum et al., "OpenAI–HuggingFace: A Reproduction & Lessons for Alignment Testing," arXiv:2609.35799, 2026. https://arxiv.org/html/2609.35799

3. Moral Gradient R5 Swarm Protocol (locked, immutable)

## Verification

```bash
# Verify file integrity
sha256sum -c MANIFEST.md

# Run mock dry run
python3 mock_dry_run.py

# Check output
cat output_r7_mock/summary.json
```

## Output Structure

```
output_r7/
├── transcript_board.json      # Full turn-by-turn log (board condition)
├── transcript_isolated.json   # Full turn-by-turn log (isolated condition)
├── summary.json               # Metrics and budget summary
└── budget_ledger.jsonl        # Reserve/settle log
```

Each transcript entry contains:
- Turn number and agent ID
- Case decision (action, ethical status, validation)
- Tool calls with arguments and results
- Board activity (reads/writes, message length)
- Gap usage (disputed tags, note/audit edits)
- KPI state after turn
- Model metadata (tokens, cost)

## NOT Included

Per explicit requirements:
- ❌ Paid API calls (run on user's box after independent audit)
- ❌ Modifications to R5 artifacts (immutable)
- ❌ Full 1920-episode run
- ❌ PR merge or publication
