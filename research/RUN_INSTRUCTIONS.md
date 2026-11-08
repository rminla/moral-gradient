# Moral Gradient v4 Research Harness - Execution Instructions

**Version**: 1.0.0 (2026-11-08)  
**Budget**: $70 USD total (incremental ledger across all runs)  
**Status**: Ready for coordinator execution with API credentials

## Prerequisites

1. **Python 3.10+** installed
2. **API credentials** as environment variables:
   ```bash
   export ANTHROPIC_API_KEY=sk-ant-...
   export GROQ_API_KEY=gsk_...
   export OPENROUTER_API_KEY=sk-or-...
   ```
3. **Ledger location**: All runs use `research/ledger.db` (shared, incremental)

## Installation

```bash
# Extract archive
tar -xzf moral-gradient-v4-harness.tar.gz
cd research

# Install dependencies
pip3 install -r requirements.txt
```

## Execution Order

### 1. Quiz Comparison (Run First)

**Purpose**: Validate infrastructure and model costs  
**Expected cost**: $1.30-4.00  
**Expected time**: 30-60 minutes

```bash
python3 quiz/run_quiz.py --budget-cap 5.00
```

**Output**: `manifests/quiz_TIMESTAMP.json` with all 800 responses

### 2. Swarm Small Validation (Optional)

**Purpose**: Test swarm infrastructure before main run  
**Estimated cost**: $0.50-2.00  
**Estimated time**: 10-20 minutes

```bash
# Create test config with n=2
cat > swarm/config_test.json << 'EOF'
{
  "version": "1.0.0",
  "n_per_arm": 2,
  "randomization_seed": 42,
  "max_turns": {"single": 4, "team": 8},
  "sampling": {"temperature": 1.0, "max_tokens": 512},
  "models": ["anthropic/claude-haiku-5-5"],
  "arms": [
    {"id": "single_no_pressure", "structure": "single", "pressure": false},
    {"id": "team_no_pressure", "structure": "team", "pressure": false}
  ]
}
EOF

python3 swarm/run_swarm.py --config swarm/config_test.json --budget-cap 2.00
```

### 3. Swarm Main Experiment

**Purpose**: Full 4-model, 4-case, 4-arm swarm comparison  
**Expected cost**: $45-65  
**Expected time**: 4-8 hours

```bash
python3 swarm/run_swarm.py --budget-cap 65.00
```

**Output**: `manifests/swarm_TIMESTAMP.json` with all episodes

## Budget Monitoring

Check ledger status at any time:

```bash
sqlite3 ledger.db "SELECT 
  experiment,
  COUNT(*) as calls,
  SUM(actual_cost_usd) as cost_usd
FROM calls 
GROUP BY experiment"
```

Global budget check:

```bash
sqlite3 ledger.db "SELECT 
  COUNT(*) as total_calls,
  SUM(actual_cost_usd) as total_cost_usd
FROM calls"
```

## Resume After Interruption

All runs support checkpoint/resume:

```bash
# Quiz resume
python3 quiz/run_quiz.py --resume manifests/quiz_TIMESTAMP_checkpoint.json

# Swarm resume
python3 swarm/run_swarm.py --resume manifests/swarm_TIMESTAMP_checkpoint.json
```

## Dry-Run Testing (No API Calls)

Test infrastructure without spending:

```bash
# Test quiz (mock calls)
python3 quiz/run_quiz.py --dry-run

# Test swarm (mock calls)
python3 swarm/run_swarm.py --dry-run

# Test specific model
python3 -c "
import sys
sys.path.insert(0, '.')
from lib.models import verify_model_availability
print(verify_model_availability())
"
```

## Model Configuration

Current models (from v3 model_versions.json):

1. **anthropic/claude-haiku-5-5**
   - Provider: Anthropic
   - Params: `thinking: {type: adaptive, display: summarized}, output_config: {effort: medium}`
   - Pricing: $0.10/$0.50 per 1M tokens (input/output)

2. **groq/openai/gpt-oss-120b**
   - Provider: Groq
   - Params: `reasoning_effort: medium`
   - Pricing: $0.15/$0.60 per 1M tokens

3. **groq/qwen/qwen3.6-27b**
   - Provider: Groq
   - Params: `reasoning_format: parsed`
   - Pricing: $0.60/$3.00 per 1M tokens
   - ⚠️ **Availability uncertain** (retired for dev tier 2026-09-14, but served 2026-11-02)

4. **openrouter/google/gemini-3.8-flash**
   - Provider: OpenRouter
   - Params: `reasoning: {effort: medium}`
   - Pricing: $0.825/$4.125 per 1M tokens
   - ⚠️ **OpenRouter balance**: ~$3.61 available (may need top-up)

## Safety Features

- ✅ Atomic budget reservation before each call
- ✅ Hard cap at $70 (execution stops if exceeded)
- ✅ Idempotent call IDs (no duplicate charges)
- ✅ Per-provider tracking
- ✅ Checkpoint every 10 calls (quiz) / 5 episodes (swarm)
- ✅ No placeholders (execution stops if `[TO BE FINALIZED]` found)

## Troubleshooting

### Budget Exceeded Error

If execution stops with "Budget exceeded":
- Check total spent: `sqlite3 ledger.db "SELECT SUM(actual_cost_usd) FROM calls"`
- Resume from checkpoint with adjusted cap if appropriate

### Model Unavailable

If Qwen fails:
- Edit `quiz/config.json` and `swarm/config.json` to remove `groq/qwen/qwen3.6-27b`
- Or substitute another model

### OpenRouter Insufficient Balance

If Gemini calls fail with balance error:
- Top up OpenRouter account
- Or reduce Gemini sample size in configs

### API Key Issues

Verify credentials are set:
```bash
python3 -c "import os; print('ANTHROPIC:', bool(os.getenv('ANTHROPIC_API_KEY'))); print('GROQ:', bool(os.getenv('GROQ_API_KEY'))); print('OPENROUTER:', bool(os.getenv('OPENROUTER_API_KEY')))"
```

## Output Files

After successful execution:

- `manifests/quiz_TIMESTAMP.json` - Quiz results (800 calls)
- `manifests/swarm_TIMESTAMP.json` - Swarm results (1,920 episodes)
- `ledger.db` - Complete cost ledger
- `manifests/*_checkpoint.json` - Intermediate checkpoints

## Next Steps After Execution

1. Verify total cost: `sqlite3 ledger.db "SELECT SUM(actual_cost_usd) FROM calls"`
2. Transfer manifests and ledger back for analysis
3. Run analysis scripts (separate from this harness)

## Support

For issues or questions:
- Check `research/VALIDATION_REPORT.md` for detailed documentation
- Review `research/README.md` for architecture overview
- See methodology in `quiz/METHOD.md` and `swarm/METHOD.md`
