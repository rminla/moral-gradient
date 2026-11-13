# Moral Gradient v3final: reproduction package

This folder holds everything behind the v3final results on moralgradient.org: the harness code as it was run, the exact prompts and grading rubrics, model versions and settings, and a record of every run. You can recheck every published v3final number from these files without calling any model.

## What v3final is

One locked run of the v3 test suite on four models: Claude Haiku 5.5, gpt-oss-120b, Qwen 3.6 27B and Gemini 3.8 Flash. It ran on November 2, 2026, from 2:02 AM to 5:28 AM PT (model calls), with reasoning-trace grading from 5:28 AM to 6:05 AM PT. The site's aggregate numbers (`/api/v3`, `data/v3-bundle.json` in this repo) come from this run.

## Preregistration status (please read)

v3final was **frozen internally but not publicly preregistered.**

- The method was written down in advance in `harness/v3/METHOD.md`. Its last change before the run was on November 1, 2026, at 6:46 AM PT. The "pre-lock amendments" it lists are dated October 31, 2026. The reasoning-trace analysis (section 12) was added on October 31, 2026, before the run, and was applied after the main stage as planned.
- The harness was committed at internal commit `4a47163` (November 2, 2026, 2:02 AM PT), about 20 seconds before the first model call. The site cites commit `895e032` (November 2, 6:08 AM PT). The only code difference between the two is one line in `harness/v3/traces.py` that raised the trace-grading cost cap from $85 to $86 so grading could finish. Everything else in `895e032` is output files. The `harness/` folder here is taken from `895e032`.
- None of this was filed with a public registry (OSF, AsPredicted or similar) before the run, and the commits were in a private repository. So there is no independent, timestamped proof that the plan came before the data. We can't fix that after the fact, and we don't claim otherwise.
- `METHOD.md` still opens with "Status: draft, iterating" and "Nothing here is published." That header is the original text, left unchanged. It was not updated when the method froze.
- Future studies will be preregistered publicly before any data is collected.

## Contents

| Path | What it is |
|---|---|
| `harness/` | The v3 harness from internal commit `895e032`: runner (`v3/run.py`), API client, scenarios (`v3/cases.py`, `v2/items_v2.py`, `v1/items_v1.py`), analysis (`v3/analyze.py`, `v3/traces.py`, `v3/stats.py`), tool-call validation, the locked run script (`v3/run_locked.sh`), method (`v3/METHOD.md`) and development log (`v3/ITERATIONS.md`). See `REDACTIONS.md` for the few text edits. |
| `PROMPTS.md` | Readable versions of the prompts, rendered from the harness. |
| `RUBRICS.md` | Every grader prompt and label set, and which graders scored which model. |
| `MODELS.md` | Model ids, providers, sampling settings, and the model versions and timestamps recorded during the run. |
| `data/<model>/records.jsonl` | One row per test unit (1,028 to 1,030 per model): scenario, level, hardship or stakes rung, paraphrase, cue and arm, tool calls, final text, the reasoning the provider returned, outcome, grader labels and cost. |
| `data/<model>/trace_codes.jsonl` | The two reasoning-trace graders' codes for each self-interest episode and pressure turn. The trace text itself is in `records.jsonl`. |
| `data/<model>/calibrate.jsonl`, `calibration.json` | Calibration stage rows and the levels it selected for that model. |
| `data/model_versions.json` | Raw version record. |
| `aggregates/` | Outputs the harness produced at `895e032`: `bundle.json`, `tables.md`, and the trace analysis (`traces/`). |
| `reproduce/headline_numbers.py` | Recomputes the main self-interest numbers using only the Python standard library. Expected output is in `headline_numbers.expected.txt`. |
| `rerun_offline.sh` | Rebuilds `aggregates/bundle.json` from the records with the original analysis code and compares it field by field. |
| `calls/<model>/*.jsonl.gz` | The full API call logs (every request and raw response, target and grader), with provider request ids and opaque signature blobs removed. Large; see "Call logs" below. |
| `MANIFEST.sha256` | Checksums for every file. |

## How to recheck the numbers (no API calls)

Quick check of the headline numbers, standard library only:

```
cd research/v3final
python3 reproduce/headline_numbers.py
```

For Claude Haiku 5.5, this prints 41/48 runs that kept the fee with the budget memo, 21/48 with the neutral memo and 23/48 with no memo. It also prints the components of the reasoning measure: 4/48 runs whose reasoning used the memo as a reason to keep the fee, and 37/48 that kept the fee without that. 37/48 minus 21/48 is the +33 point figure.

Full rebuild with the original analysis code (needs Python 3.11+ with numpy, scipy, matplotlib and requests; no keys):

```
bash rerun_offline.sh /tmp/v3rerun
```

This copies the harness and records into a scratch folder, runs `v3/analyze.py` and `v3/traces.py analyze`, then compares the result with `aggregates/bundle.json`. With the call logs present, we got 0 differences. Without them, 5 fields differ, and these are expected: the four per-model `cost_usd` totals and one trace-coverage counter, because the code reads those from the call logs.

## How to rerun the grading

The graders are LLMs, so regrading costs money and needs API keys. The steps:

1. Set `ANTHROPIC_API_KEY` and `GROQ_API_KEY` in your environment. The code reads keys from the environment only.
2. Arrange the data as `rerun_offline.sh` does, then delete `traces.jsonl` and run `python3 v3/traces.py grade v3final --budget <usd>`.
3. Run `python3 v3/traces.py analyze v3final` and compare.

Expect close but not identical labels. Grader models may have changed since November 2, 2026, and Claude Haiku 5.5 ran as a grader at its provider default temperature (the other two graders used temperature 0). The trace-grading spend in v3final was about $1.41 across all four models (sum of `cost_usd` in the trace call logs).

## How to rerun the whole experiment

`harness/v3/run_locked.sh` is the exact script that ran. Target models were sampled with provider defaults (no temperature or seed set), so new runs will produce different text and somewhat different rates. The full run cost about $24.98 across all four models: $23.57 in calibration and main-stage calls plus $1.41 in trace grading (sums of `cost_usd` in the call logs). That covers every scenario and the pressure tests, not just self-interest.

## Reading the records

- `outcome` for late-fee DO episodes: `act` = a valid `waive_fee` call, `escalate`, `keep` = reply sent without waiving, `no_action`. Only valid tool calls count (see METHOD.md section 13).
- `key` encodes `phase|case|level|stakes|para|s|esc|cue|arm`.
- `thinking` is whatever reasoning the provider returned. For Claude Haiku 5.5 and Gemini 3.8 Flash it is a provider-written summary, not the full reasoning. For gpt-oss-120b and Qwen it is the raw reasoning text.
- Customer names, companies and account numbers in the scenarios (for example "Maria", "Lakeline Internet", "LK-20931") are fictional.

## Known limits

- Not publicly preregistered (see above).
- Reasoning-trace and rationale grades have not been checked against human labels. A two-reviewer blind check is planned.
- The self-interest cue (`memo_soft`) is a team scorecard line. It shows the memo changes behavior. It does not show why: the model may be following an organizational instruction rather than serving any interest of its own.
- Two v3final scripts count "kept the fee" slightly differently. The behavior numbers (`v3/analyze.py`, used for the site's self-interest charts) count only episodes that sent a reply without waiving. The reasoning numbers (`v3/traces.py`) count every episode without a valid waiver, including 4 Qwen episodes that ended with no reply at all. So Qwen's budget-memo keep rate is 28/48 on the behavior charts and 31/48 inside the reasoning measures. The other models are unaffected. `headline_numbers.py` prints both.
- METHOD.md names budget memo vs no memo as the primary comparison and budget memo vs neutral memo as secondary. Both are in the data and in `headline_numbers.py`.

## Call logs

The call logs are about 34 MB compressed (about 134 MB uncompressed). They are published as a separate download rather than in git history. The records and aggregates in this folder are enough to recheck every published v3final number. The call logs add the exact multi-turn requests and raw provider responses.

## License

[To be chosen by the project owner before publishing.]
