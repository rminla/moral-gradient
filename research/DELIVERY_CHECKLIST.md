# v4 Research Harness Delivery Checklist

**Date**: 2026-11-08  
**PR**: https://github.com/rminla/moral-gradient/pull/2  
**Branch**: `cursor/v4-research-harness-de8d`  
**Status**: ✅ Implementation complete, awaiting coordinator review

---

## ✅ Delivered Artifacts

### Methodology Documents

- [x] **Quiz METHOD.md** (`research/quiz/METHOD.md`)
  - Experimental design locked: 10 questions, 4 models, n=20
  - Exact prompt template recorded
  - Response parsing rules specified
  - Cost estimates: $1.30-4.00

- [x] **Swarm METHOD.md** (`research/swarm/METHOD.md`)
  - Team structure defined: worker/manager/reviewer
  - 4 arms: single/team × no-pressure/pressure
  - Episode structure: max 8 turns team, 4 single
  - Cost estimates: $45-150
  - ⚠️ Operational definitions proposed but not final

### Runnable Harness

- [x] **Budget Tracker** (`research/lib/budget.py`)
  - Atomic reservation system
  - SQLite ledger with idempotent calls
  - Per-provider and global tracking
  - Hard cap enforcement

- [x] **Provider Clients** (`research/lib/providers.py`)
  - Anthropic, Groq, OpenRouter support
  - Cost calculation and tracking
  - Mock mode for testing
  - Retry logic

- [x] **Model Configs** (`research/lib/models.py`)
  - All 4 models configured with pricing
  - Version tracking
  - Availability flags

- [x] **Quiz Harness** (`research/quiz/run_quiz.py`)
  - Executable with `--dry-run` flag
  - Checkpoint/resume capability
  - Exact scenarios from uploaded file
  - Balanced randomization

- [x] **Swarm Harness** (`research/swarm/run_swarm.py`)
  - Executable with `--dry-run` flag
  - Checkpoint/resume capability
  - Single and team episode execution
  - ⚠️ Needs case/prompt content finalization

### Configuration Files

- [x] **Quiz scenarios** (`research/quiz/scenarios.json`)
  - All 10 questions with exact text
  - Options with semantic IDs
  - Source attribution

- [x] **Quiz config** (`research/quiz/config.json`)
  - n=20, balanced randomization
  - Sampling parameters
  - Model list

- [x] **Swarm cases** (`research/swarm/cases.json`)
  - 4 case structures defined
  - ⚠️ Scenario text placeholders need finalization
  - Action options specified

- [x] **Swarm prompts** (`research/swarm/prompts.json`)
  - Role prompt templates
  - ⚠️ Exact wording placeholders need finalization
  - Pressure manipulation structure

- [x] **Swarm config** (`research/swarm/config.json`)
  - n=30 per arm
  - Turn limits (8 team, 4 single)
  - Arm definitions

### Tests

- [x] **Budget tests** (`research/tests/test_budget.py`)
  - Reservation and reconciliation
  - Cap enforcement
  - Per-provider tracking
  - Idempotency

- [x] **Provider tests** (`research/tests/test_providers.py`)
  - Mock calls
  - Cost estimation
  - Multiple models

- [x] **Quiz tests** (`research/tests/test_quiz.py`)
  - Dry-run execution
  - Prompt generation
  - Response parsing
  - Checkpoint/resume

- [x] **Swarm tests** (`research/tests/test_swarm.py`)
  - Single and team episodes
  - Action extraction
  - Turn limits

### Documentation

- [x] **Main README** (`research/README.md`)
  - Structure overview
  - Usage instructions
  - Budget tracking explanation

- [x] **Validation Report** (`research/VALIDATION_REPORT.md`)
  - Feature summary
  - Test results
  - Next steps
  - Open questions

- [x] **This Checklist** (`research/DELIVERY_CHECKLIST.md`)
  - Complete inventory
  - Clear separation of done vs pending

### Support Files

- [x] **requirements.txt** (`research/requirements.txt`)
  - All Python dependencies

- [x] **.gitignore** (`research/.gitignore`)
  - Excludes artifacts, cache, credentials

---

## ⚠️ Pending Items (Required Before Execution)

### Content Finalization

- [ ] **Swarm case scenarios** (`research/swarm/cases.json`)
  - Current: Placeholder text marked `[TO BE FINALIZED]`
  - Need: Exact scenario descriptions for all 4 cases
  - Source: Coordinator may have from v3 or needs to create

- [ ] **Swarm role prompts** (`research/swarm/prompts.json`)
  - Current: Placeholder prompts marked `[TO BE FINALIZED]`
  - Need: Exact wording for worker/manager/reviewer roles
  - Need: Exact pressure manipulation text

### Credentials & Access

- [ ] **API Keys**
  - Need: `ANTHROPIC_API_KEY=sk-ant-...`
  - Need: `GROQ_API_KEY=gsk_...`
  - Need: `OPENROUTER_API_KEY=sk-or-...`
  - Set as environment variables on coordinator's box

- [ ] **Provider Balance Verification**
  - OpenRouter: ~$3.61 available (per preflight)
  - May need top-up for full experiment
  - Verify Anthropic and Groq balances

### Model Verification

- [ ] **Qwen Availability**
  - `groq/qwen/qwen3.6-27b` reported retired for dev tier (2026-09-14)
  - But served successfully on 2026-11-02
  - Verify before execution or have fallback plan

### Final Approvals

- [ ] **Budget Approval Confirmation**
  - Current: $70 USD total cap
  - Quiz: ~$5 sub-cap
  - Swarm: ~$65 sub-cap
  - Confirm this allocation is final

- [ ] **Methodology Review**
  - Review quiz METHOD.md
  - Review swarm METHOD.md
  - Approve proposed implementation choices
  - Distinguish proposed vs previously approved elements

### Missing Source Files

- [ ] **v3 Reference Files** (optional, for consistency)
  - `/workspace/moral-compass/pilot/v3/METHOD.md`
  - `/workspace/moral-compass/pilot/v3/out/v3final/`
  - Any existing case definitions
  - Coordinator can transfer if needed

---

## 🚫 Explicitly NOT Done (Out of Scope)

- **NO paid API calls made** - All testing was with mock providers
- **NO UI modifications** - Independent of active UI/layout work
- **NO site integration** - Results will be separate artifacts
- **NO v4 changed research tasks** - Not defined in $70 scope
- **NO grading implementation** - Deferred pending cost/rubric approval
- **NO subjective metrics** - Only deterministic action extraction implemented
- **NO analysis code** - Will be created after data collection

---

## 📋 Execution Readiness Checklist

Before running with real API calls, verify:

- [ ] All pending items above are completed
- [ ] Harness transferred to coordinator's box with credentials
- [ ] Python 3.10+ installed with dependencies
- [ ] Budget cap approved and configured
- [ ] Dry-run test passes: `python quiz/run_quiz.py --dry-run`
- [ ] Dry-run test passes: `python swarm/run_swarm.py --dry-run`
- [ ] Provider API keys tested independently
- [ ] Model availability verified
- [ ] Ledger database initialized correctly

---

## 🔄 Recommended Execution Order

1. **Quiz first** (low cost, validates infrastructure)
   ```bash
   python quiz/run_quiz.py --budget-cap 5.00
   ```
   - Expected: ~$1.50
   - Validates: Budget tracking, provider clients, model configs
   - Time: ~30-60 minutes

2. **Swarm next** (if budget allows)
   ```bash
   python swarm/run_swarm.py --budget-cap 65.00
   ```
   - Expected: ~$45 (could be much higher)
   - Validates: Multi-agent execution, turn limits
   - Time: Several hours

3. **Monitor ledger** during execution
   ```bash
   sqlite3 research/ledger.db "SELECT experiment, COUNT(*) as calls, SUM(actual_cost_usd) as cost FROM calls GROUP BY experiment"
   ```

4. **Resume if interrupted**
   - Checkpoint files saved every 10 calls (quiz) or 5 episodes (swarm)
   - Resume with: `--resume manifests/[experiment]_TIMESTAMP.json`

---

## 📊 Expected Outputs

After successful execution:

### Quiz
- `manifests/quiz_TIMESTAMP.json` - All 800 responses with metadata
- `ledger.db` - Cost accounting
- Ready for: Distribution analysis, position bias analysis

### Swarm
- `manifests/swarm_TIMESTAMP.json` - All 1,920 episodes with turns
- `ledger.db` - Cost accounting
- Ready for: Team vs single comparison, pressure effect analysis

---

## ❓ Open Questions for Coordinator

1. **Swarm content source**
   - Use placeholder text as-is?
   - Provide exact v3 case text?
   - Write new scenarios?

2. **Swarm prompt wording**
   - Approve proposed templates?
   - Specify exact wording requirements?

3. **Qwen model**
   - Verify availability first?
   - Proceed and handle failure?
   - Substitute different model?

4. **OpenRouter balance**
   - Top-up approved if needed?
   - Or reduce Gemini sample size?

5. **Budget allocation**
   - Confirm $70 total, $5 quiz, $65 swarm?
   - Or different split?

6. **Execution location**
   - Run on coordinator's box?
   - Or transfer to cloud compute?

7. **v3 consistency**
   - Need v3 reference files?
   - Any specific compatibility requirements?

---

## 📦 Portable Harness

The complete harness is now on branch `cursor/v4-research-harness-de8d`:

```
research/
├── README.md                   # Usage overview
├── VALIDATION_REPORT.md        # Detailed report
├── DELIVERY_CHECKLIST.md       # This file
├── requirements.txt            # Dependencies
├── .gitignore                  # Excludes artifacts
├── lib/                        # Core infrastructure
│   ├── budget.py               # Budget tracking
│   ├── providers.py            # Provider clients
│   └── models.py               # Model configs
├── quiz/                       # Quiz experiment
│   ├── METHOD.md               # Methodology
│   ├── scenarios.json          # 10 questions
│   ├── config.json             # Parameters
│   └── run_quiz.py             # Harness
├── swarm/                      # Swarm experiment
│   ├── METHOD.md               # Methodology
│   ├── cases.json              # 4 cases (needs finalization)
│   ├── prompts.json            # Prompts (needs finalization)
│   ├── config.json             # Parameters
│   └── run_swarm.py            # Harness
└── tests/                      # Test suite
    ├── test_budget.py
    ├── test_providers.py
    ├── test_quiz.py
    └── test_swarm.py
```

Coordinator can:
- Clone repo
- Checkout branch
- Review/modify on their box
- Add credentials
- Execute when ready

---

**Summary**: Implementation is complete and tested with mock providers. Swarm content needs finalization and credentials are required before paid execution can begin. All safety controls are in place.
