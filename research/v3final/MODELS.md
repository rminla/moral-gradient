# Models, versions and settings (v3final)

Source: `harness/v3/registry.json` (settings as run) and `data/model_versions.json` (written by `harness/v3/record_versions.py` before and after the run). Times are converted from UTC to Pacific Time (UTC-8 on these dates).

| Name in data | Role | Provider | Model id requested | Sampling params (target) | Grader params | Max output tokens | Reasoning exposed | Price used for cost cap ($/1M in / out) |
|---|---|---|---|---|---|---|---|---|
| claude-haiku-5.5 | target, grader | anthropic | `claude-haiku-5-5` | `{"thinking": {"type": "adaptive", "display": "summarized"}, "output_config": {"effort": "medium"}}` | `{}` | 8000 | summary | 0.1 / 0.5 |
| gpt-oss-120b | target, grader | groq | `openai/gpt-oss-120b` | `{"reasoning_effort": "medium"}` | `{"temperature": 0, "reasoning_effort": "low"}` | 8000 | raw | 0.15 / 0.6 |
| qwen3.6-27b | target | groq | `qwen/qwen3.6-27b` | `{"reasoning_format": "parsed"}` | `{}` | 8000 | raw | 0.6 / 3.0 |
| gemini-3.8-flash | target | openrouter | `google/gemini-3.8-flash` | `{"reasoning": {"effort": "medium"}}` | `{}` | 8000 | summary | 0.825 / 4.125 |
| qwen3.8-27b | grader | groq | `qwen/qwen3.8-27b` | `{}` | `{"temperature": 0}` | 2000 | raw | 0.8 / 4.0 |

No temperature or seed was set for targets; provider defaults apply, so reruns will not reproduce text exactly. Grader temperature is 0 where the provider accepts it (`grader_params`). Grader max output: 2000 tokens. OpenRouter calls record the provider-billed cost; others use the listed prices.

## Versions observed during the run

| Name | Provider metadata checked | Provider metadata | Model string returned | Calls | First call | Last call |
|---|---|---|---|---|---|---|
| claude-haiku-5.5 | 2026-11-02 02:01 PT | `{"id": "claude-haiku-5-5", "display_name": "Claude Haiku 5.5", "created_at": "2026-10-07T18:00:00Z"}` | claude-haiku-5-5 | 4567 | 2026-11-02 02:02 PT | 2026-11-02 03:51 PT |
| claude-haiku-5.5 | 2026-11-02 02:01 PT | `{"id": "claude-haiku-5-5", "display_name": "Claude Haiku 5.5", "created_at": "2026-10-07T18:00:00Z"}` | claude-haiku-5-5 | 662 | 2026-11-02 05:56 PT | 2026-11-02 06:05 PT |
| gpt-oss-120b | 2026-11-02 02:01 PT | `{"id": "openai/gpt-oss-120b", "owned_by": "OpenAI", "created": 1754408224}` | (none: failed or errored call) | 505 | 2026-11-02 02:02 PT | 2026-11-02 02:29 PT |
| gpt-oss-120b | 2026-11-02 02:01 PT | `{"id": "openai/gpt-oss-120b", "owned_by": "OpenAI", "created": 1754408224}` | openai/gpt-oss-120b | 5106 | 2026-11-02 02:02 PT | 2026-11-02 05:28 PT |
| gpt-oss-120b | 2026-11-02 02:01 PT | `{"id": "openai/gpt-oss-120b", "owned_by": "OpenAI", "created": 1754408224}` | openai/gpt-oss-120b | 985 | 2026-11-02 05:28 PT | 2026-11-02 06:05 PT |
| qwen3.6-27b | 2026-11-02 02:01 PT | `{"id": "qwen/qwen3.6-27b", "owned_by": "Alibaba Cloud", "created": 1778288776}` | (none: failed or errored call) | 2 | 2026-11-02 02:48 PT | 2026-11-02 03:11 PT |
| qwen3.6-27b | 2026-11-02 02:01 PT | `{"id": "qwen/qwen3.6-27b", "owned_by": "Alibaba Cloud", "created": 1778288776}` | qwen/qwen3.6-27b | 3560 | 2026-11-02 02:02 PT | 2026-11-02 03:51 PT |
| gemini-3.8-flash | 2026-11-02 02:01 PT | `{"id": "google/gemini-3.8-flash", "canonical_slug": "google/gemini-3.8-flash-20260902", "created": 1788362056, "context_length": 1048576}` | (none: failed or errored call) | 2 | 2026-11-02 05:12 PT | 2026-11-02 05:14 PT |
| gemini-3.8-flash | 2026-11-02 02:01 PT | `{"id": "google/gemini-3.8-flash", "canonical_slug": "google/gemini-3.8-flash-20260902", "created": 1788362056, "context_length": 1048576}` | google/gemini-3.8-flash | 3481 | 2026-11-02 02:02 PT | 2026-11-02 05:28 PT |
| qwen3.8-27b | 2026-11-02 02:01 PT | `{"id": "qwen/qwen3.8-27b", "owned_by": "Alibaba Cloud", "created": 1786984846}` | qwen/qwen3.8-27b | 1733 | 2026-11-02 02:04 PT | 2026-11-02 05:28 PT |
| qwen3.8-27b | 2026-11-02 02:01 PT | `{"id": "qwen/qwen3.8-27b", "owned_by": "Alibaba Cloud", "created": 1786984846}` | qwen/qwen3.8-27b | 964 | 2026-11-02 05:28 PT | 2026-11-02 06:01 PT |

Rows with no returned model string are calls that errored (rate limits, timeouts) and were retried.

