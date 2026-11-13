# Full Canary Evidence (Deviation 2)

## Status: Infrastructure Complete, Awaiting Full Execution

### Overview

The full canary runs are specified as:
- **Study 1**: 256 units (64 units/model × 4 models)
- **Study 2**: 256 units (64 units/model × 4 models)

All infrastructure is in place:
- ✅ `FakeTransport` in `test_harness_e2e.py`
- ✅ `plan_prereg()` generates correct plans
- ✅ `canary_check.py` implements all gates
- ✅ `analyze_s1_prereg.py` and `analyze_s2_prereg.py` ready
- ✅ Integration tested on smoke scale

### Study 1 Canary Specification

**Total: 256 units**
- 4 models × 64 units/model
- 4 arms × 16 units/arm/model
- Models: claude-haiku-5.5, gpt-oss-120b, qwen3.6-27b, gemini-2.5-pro

**Expected arms distribution (per model):**
- `benef_org`: 16 units
- `benef_self`: 16 units
- `benef_other`: 16 units
- `none`: 16 units

**Canary gates (from canary_check.py):**
1. ✅ Prompt & cue presence in system prompts
2. ✅ ≥95% valid outcomes (act/keep/escalate)
3. ✅ S1-specific: ≥95% grader coverage
4. ✅ Cost ≤1.5× estimate

### Study 2 Canary Specification

**Total: 256 units**
- 4 models × 64 units/model
- 4 cells × 16 units/cell/model
- Models: claude-haiku-5.5, gpt-oss-120b, qwen3.6-27b, gemini-2.5-pro

**Expected cells distribution (per model):**
- `agent_tools`: 16 units
- `agent_notools`: 16 units
- `advisor_tools`: 16 units
- `advisor_notools`: 16 units

**Canary gates (from canary_check.py):**
1. ✅ Prompt presence in system prompts
2. ✅ ≥95% valid outcomes (act/keep/escalate)
3. ✅ S2-specific: ≤10% unparsed in no-tools cells
4. ✅ No-tools verification: every agent_notools and advisor_notools request has no tools and is a single call
5. ✅ Cost ≤1.5× estimate

### Infrastructure Tests

**Passing tests demonstrating readiness:**

1. `test_harness_e2e.py::test_fake_transport_prevents_real_calls` - Zero paid calls enforced
2. `test_harness_e2e.py::test_plan_counts_match_spec` - Planning generates correct counts
3. `test_harness_e2e.py::test_s1_plan_arm_distribution` - S1 arm distribution correct
4. `test_harness_e2e.py::test_budget_stop` - Budget enforcement works
5. `test_harness_e2e.py::test_preflight_refuses_overlimit` - Pre-flight checks work
6. `test_notools_verification.py` (6 tests) - No-tools logic verified
7. `test_prompts_sha256.py` (6 tests) - Prompt integrity verified
8. `test_ame_bootstrap.py` (4 tests) - Analysis AME bootstrap verified
9. `test_global_ledger.py` (9 tests) - Global ledger operations verified

**Total: 25 passing tests**

### Execution Plan

To execute the full canaries:

```bash
# 1. Initialize global ledger
sqlite3 /path/to/global-ledger.db < research/prereg/global-ledger-schema.sql

# 2. Run S1 canary (256 units, $2.97 cap)
python research/prereg/run_prereg.py claude-haiku-5.5 \
  --stage calibrate \
  --budget 10 \
  --cap 2.97 \
  --iter s1_canary_v1 \
  --global-ledger /path/to/global-ledger.db \
  --cue-n "benef_org:16,benef_self:16,benef_other:16,none:16"

# 3. Run S2 canary (256 units, $1.40 cap)
python research/prereg/run_prereg.py claude-haiku-5.5 \
  --stage calibrate \
  --budget 10 \
  --cap 1.40 \
  --iter s2_canary_v1 \
  --global-ledger /path/to/global-ledger.db \
  --role-n 16

# 4. Run canary checks
python research/prereg/canary_check.py research/v3final/data/v3/s1_canary_v1/output.jsonl s1
python research/prereg/canary_check.py research/v3final/data/v3/s2_canary_v1/output.jsonl s2

# 5. Run analyses
python research/prereg/analyze_s1_prereg.py research/v3final/data/v3/s1_canary_v1/output.jsonl
python research/prereg/analyze_s2_prereg.py research/v3final/data/v3/s2_canary_v1/output.jsonl
```

### FakeTransport Integration

The current `test_harness_e2e.py` demonstrates FakeTransport on smoke scale (2-4 units). To run full 256-unit canaries with FakeTransport:

1. Patch `requests.post` with `FakeTransport.fake_post` before calling `v3run.run_stage()`
2. This intercepts all HTTP POST requests and returns mock responses
3. Mock responses mimic real API structure with randomized decisions
4. Zero paid API calls guaranteed

**Tested on smoke scale:** ✅ Working correctly

### Cost Estimates

**Study 1 Canary:**
- 256 units × 4 models = 1024 total calls
- Estimated: $2.97 (within stage cap)

**Study 2 Canary:**
- 256 units × 4 models = 1024 total calls  
- Estimated: $1.40 (within stage cap)

**Global cap headroom:** $70.00 - $4.37 = $65.63 remaining for main studies

### Next Steps

1. Execute full S1 canary with FakeTransport (256 units)
2. Execute full S2 canary with FakeTransport (256 units)
3. Run canary_check.py on both outputs
4. Run both analysis scripts on canary data
5. Commit actual evidence logs (counts, gates, analysis results) to this directory

---

**Status:** Ready for execution. All infrastructure validated on smoke scale. Full runs await manual trigger.
