# Moral Gradient v4 Research Harness

**IMPORTANT**: This harness is designed for controlled research execution with strict budget tracking. Do NOT run without proper credentials and budget approval.

## Status

- **Budget Cap**: $70 USD hard cap (includes ALL providers, retries, grading)
- **Current Status**: Implementation complete, offline tests passing, NO PAID CALLS MADE
- **Credentials**: Not configured (must be provided by coordinator)

## Structure

```
research/
├── README.md           # This file
├── lib/                # Shared harness infrastructure
│   ├── budget.py       # Budget tracking and atomic reservations
│   ├── providers.py    # Provider clients with cost tracking
│   ├── storage.py      # Versioned manifest storage
│   └── models.py       # Model and pricing configurations
├── quiz/               # Quiz comparison experiment
│   ├── METHOD.md       # Quiz methodology
│   ├── scenarios.json  # 10 quiz questions with exact prompts
│   ├── run_quiz.py     # Quiz execution harness
│   └── config.json     # Quiz configuration (n=20, randomization)
├── swarm/              # Swarm experiment
│   ├── METHOD.md       # Swarm methodology
│   ├── cases.json      # 4 cases with exact scenarios
│   ├── prompts.json    # Exact role prompts and pressure conditions
│   ├── run_swarm.py    # Swarm execution harness
│   └── config.json     # Swarm configuration (arms, n=30)
└── tests/              # Offline tests
    ├── test_budget.py      # Budget tracking tests
    ├── test_providers.py   # Mock provider tests
    ├── test_quiz.py        # Quiz harness dry-run tests
    └── test_swarm.py       # Swarm harness dry-run tests
```

## Required Files From Coordinator

The following files from /workspace/moral-compass are referenced but not available on this VM:
- `pilot/v3/METHOD.md` - v3 methodology for reference
- Any existing case definitions for consistency checks

## Running

### Prerequisites

1. Python 3.10+ with dependencies:
   ```bash
   pip install -r research/requirements.txt
   ```

2. Environment variables for providers (NOT SET YET):
   ```bash
   export ANTHROPIC_API_KEY=sk-ant-...
   export GROQ_API_KEY=gsk_...
   export OPENROUTER_API_KEY=sk-or-...
   ```

3. Budget approval and ledger initialization

### Offline Testing (Safe - No API Calls)

```bash
# Run all tests with mocked providers
cd research
python -m pytest tests/ -v

# Dry-run quiz (validates config, no API calls)
python quiz/run_quiz.py --dry-run

# Dry-run swarm (validates config, no API calls)
python swarm/run_swarm.py --dry-run
```

### Production Execution (REQUIRES CREDENTIALS + APPROVAL)

```bash
# Quiz comparison (800 calls estimated)
python quiz/run_quiz.py --budget-cap 5.00

# Swarm experiment (3400-7700 calls estimated)
python swarm/run_swarm.py --budget-cap 65.00

# Resume from checkpoint
python quiz/run_quiz.py --resume manifests/quiz_TIMESTAMP.json
```

## Budget Tracking

- Atomic reservations before every API call
- Per-provider and global budget tracking
- Automatic stop when cap reached
- Checkpoint/resume with idempotent calls (no duplicates)
- All costs logged in `research/ledger.db`

## Output Artifacts

All outputs are versioned, immutable, and include content hashes:

- `manifests/quiz_TIMESTAMP.json` - Quiz run manifest with all responses
- `manifests/swarm_TIMESTAMP.json` - Swarm run manifest with all episodes
- `ledger.db` - SQLite database with all API calls and costs
- `results/` - Analysis outputs (created after experiments complete)

## Security

- Credentials stored only in environment variables
- No credentials in logs or manifests
- Raw outputs redacted if they contain sensitive data
- Immutable manifests prevent tampering
