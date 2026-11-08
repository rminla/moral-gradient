# Moral Gradient v4 regression fixtures (2026-11-08, data only, real runs)
SDKs on run box: anthropic 2.6.0, openai 3.46.0, httpx 0.28.1, Python 3.13. Scanned: no API keys / auth headers / Bearer strings (grep + sqlite strings = 0).
- db/ledger_copy.db: copy of authoritative ledger (calls + reservations). quiz run_id quiz_v4_main_n20_20261108: 733 answers, 60 Haiku rows model_version='error' (local SDK error, never sent: httpx.Timeout vs httpx2), 7 unreconciled held reservations with no calls row (6 Gemini, 1 Qwen, unknown billing). Also earlier smoke rows (incl. 30 mock Haiku rows mock_data=1) and swarm_smoke1 rows. See db/ledger_summary.txt.
- journals/quiz/: all journals for the main quiz run (metadata {scenario_id, option_order}; model_id/raw_response/finish_reason top-level). Call ID = "<run_id>_<scenario_id>_<model_id with / -> _>_<sample>"; model slugs contain '_' (groq_openai_gpt-oss-120b).
- journals/swarm/: 12 journals of swarm_smoke1_20261108 (late_fee, team_pressure, 1 episode/model). Reviewer journals contain native tool calls: Anthropic content block type tool_use (stop_reason tool_use, thinking block first); Groq/OpenRouter message.tool_calls[0].function.name='waive_late_fee', content null, finish_reason tool_calls.
- recovered_733_manifest.json: v13 recover_from_journal rebuild output (733).
- config/: quiz config/scenarios and swarm config/cases/prompts used.
Bugs:
1. swarm run_swarm.py records tool_call=None / 'reviewer_no_tool' for all 4 reviewers despite native tool calls above.
2. tools/audit_retry_plan.py splits call_id on '_' -> "Completed: 0/800, Retry plan: 800" on this DB; ignores reservations (held).
3. quiz runner resume overwrites final manifest/checkpoint with only the new run's calls (v14 wrote 60).
Expected planner result on this DB: 733 complete; 60 retryable local errors (Haiku sofie_paintings/ceo_candidate/cancellation 0-19); 7 held unknown; 0 unattempted.
