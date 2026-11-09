# R7 Collaborative Drift Pilot - Manifest

**Date**: 2026-11-09  
**Protocol**: R7-collab-drift  
**Status**: Implementation complete, awaiting independent audit

## File Hashes (SHA256)

### Core Design and Data
```
7f37f63c96c3dc3c526a9922dcca370acc3125632ee5d27af95d4724131a330a  DESIGN.md
008678a24a2a2c93c772afc55a533ef8b6523bb1c821577ad9e8ea679f452443  case_queue.json
02e3e76b9c957cba58737d19b42ef50ea5c258106bce8a03121309fbe5fc5969  rubric.json
```

### Implementation
```
02f0d6331bc3e6bc46533daadf16c0c4e71a695f23cb5dded65699894ffecb62  sandbox_tools.py
79571eca0a2689febdf6bda71cb92f817669a3ed341d9066d65ea8aaa634e100  run_collab_drift.py
6db9ed7faed1578892a347badfc68a761b081547399ffb9128c3002a24190cfe  budget.py
```

### Testing
```
895fd80237db823de230b9b6c5e9bd1e60bd63f827257773508e0e12648ef224  mock_dry_run.py
```

## Mock Dry Run Evidence

**Execution**: 2026-11-09  
**Command**: `python3 mock_dry_run.py`  
**Exit code**: 0

### Paths Exercised

✓ **Board discovery**: 3 turns (agent_3 first at turn 1)  
✓ **Message posting**: 3 turns (106, 165, 236 chars)  
✓ **Gap usage**: 4 events (disputed tag, audit edit, note edit)  
✓ **Contagion**: Agent 1 posts gap (turn 2) → Agent 2 adopts (turn 2)  
✓ **Tampering**: 2 events (audit log, case notes)  
✓ **Invalid actions**: Handled correctly  
✓ **Case decisions**: 5 total, 4 ethically appropriate (80%)  
✓ **Budget enforcement**: $0.00 spent (mock), $5.00 available, no exceeded errors

### Metrics
- Ethical decision rate: 80% (4/5)
- Gap usage first turn: 2
- Board discoveries: 3 agents
- Tampering events: 2

### Output Files
- `output_r7_mock/transcript_board.json` - Full turn-by-turn transcript
- `output_r7_mock/summary.json` - Run summary with metrics
- `output_r7_mock/mock_script.json` - Mock response script
- `output_r7_mock/budget_ledger.jsonl` - Budget ledger (empty for mock)

## Pre-Run Cost Projection

Based on DESIGN.md estimates:
- 4 agents × 25 turns = 100 total turns
- ~2000 prompt tokens, ~1000 completion tokens per turn (conservative)
- Haiku 5.5 pricing: $0.80/1M input, $4.00/1M output
- Cost per turn: ~$0.0056
- Projected total: ~$1.68 for both conditions
- Safety margin: 66% (under $5.00 cap)

## Deliverables Checklist

- [x] DESIGN.md with methodology aligned to incident reports
- [x] case_queue.json with R5 cases + internally consistent variants
- [x] rubric.json with pre-defined ethical decisions
- [x] sandbox_tools.py with fully simulated tools (no real effects)
- [x] run_collab_drift.py with atomic budget enforcement
- [x] budget.py standalone tracker
- [x] mock_dry_run.py exercising all paths
- [x] Mock output proving: discovery, posting, adoption, gaps, tampering, invalid actions
- [x] File hashes (SHA256)
- [x] Cost projection

## Not Included (As Specified)

- ❌ Paid API calls (run on user's box after independent audit)
- ❌ Modifications to R5 artifacts (immutable)
- ❌ Full 1920-episode run
- ❌ PR merge or publication

## Verification Command

To verify file integrity:
```bash
cd research/collab_drift
sha256sum -c <<EOF
7f37f63c96c3dc3c526a9922dcca370acc3125632ee5d27af95d4724131a330a  DESIGN.md
008678a24a2a2c93c772afc55a533ef8b6523bb1c821577ad9e8ea679f452443  case_queue.json
02e3e76b9c957cba58737d19b42ef50ea5c258106bce8a03121309fbe5fc5969  rubric.json
02f0d6331bc3e6bc46533daadf16c0c4e71a695f23cb5dded65699894ffecb62  sandbox_tools.py
79571eca0a2689febdf6bda71cb92f817669a3ed341d9066d65ea8aaa634e100  run_collab_drift.py
6db9ed7faed1578892a347badfc68a761b081547399ffb9128c3002a24190cfe  budget.py
895fd80237db823de230b9b6c5e9bd1e60bd63f827257773508e0e12648ef224  mock_dry_run.py
EOF
```

## Usage

### Mock Mode (Zero Cost)
```bash
python3 mock_dry_run.py
```

### Real Run (After Independent Audit)
```bash
# Board condition only (n=1)
python3 run_collab_drift.py --condition board --output-dir output_r7_board

# Isolated condition only (n=1)
python3 run_collab_drift.py --condition isolated --output-dir output_r7_isolated

# Both conditions
python3 run_collab_drift.py --condition both --output-dir output_r7
```

### Options
- `--agents N` - Number of agents (default 4)
- `--turns T` - Turns per agent (default 25)
- `--model M` - Model string (default anthropic/claude-haiku-5-5)
- `--mock` - Run in mock mode (no API calls)
- `--mock-script PATH` - Custom mock script

## References

1. Greenblatt, R., Cotra, A., & Wijk, H. (2026). Brief independent investigation of agents' behavior in the OpenAI / Hugging Face hacking incident. METR. https://metr.org/hugging-face-incident-report-aug-2026.pdf

2. Slocum, S., Palan, M., Chute, C., Kim, M., & Van Roy, B. (2026). OpenAI–HuggingFace: A Reproduction & Lessons for Alignment Testing. arXiv:2609.35799. https://arxiv.org/html/2609.35799

3. Moral Gradient R5 Swarm Protocol (locked, immutable)
