"""HTTP clients for Anthropic, Groq and Jev. Every call goes through the ledger:
reserve worst-case cost -> send -> record usage/cost/raw output. Keys come from env
and are only placed in request headers; headers are never logged."""
import json
import random
import re
import threading
import time
import uuid

import requests

from .ledger import BudgetExceeded
from .secrets import get_key, redact

ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
JEV_URL = None  # jev-ai.org was the WRONG service; never send JEV_API_KEY there. TypeSafe Jev endpoint TBD.
RETRY_STATUS = {429, 500, 502, 503, 504, 529}


def est_tokens(obj):
    return int(len(json.dumps(obj, ensure_ascii=False)) / 3.2) + 64


class ProviderDisabled(RuntimeError):
    pass


class Clients:
    def __init__(self, ledger, cfg, prompt_version):
        self.L = ledger
        self.cfg = cfg
        self.pv = prompt_version
        self.sem = {k: threading.Semaphore(v) for k, v in cfg["concurrency"].items()}
        self.disabled = {}          # provider -> reason (circuit breaker on auth/quota errors)
        self._tl = threading.local()   # per-thread sessions (requests.Session is not thread-safe)

    @property
    def session(self):
        if not hasattr(self._tl, 's'):
            self._tl.s = requests.Session()
        return self._tl.s

    # ------------------------------------------------------------------ core
    def _send(self, provider, url, headers, body, timeout=(10, 150)):
        delay = 2.0
        N = 12   # patient retries: Groq qwen3.6 OTPM limit (32k/min) makes 429s routine
        for attempt in range(N):
            t0 = time.time()
            try:
                r = self.session.post(url, headers=headers, json=body, timeout=timeout)
            except requests.RequestException as e:
                if attempt == N - 1:
                    return None, int((time.time() - t0) * 1000), f"network: {type(e).__name__}"
                time.sleep(delay + random.random()); delay = min(delay * 2, 30); continue  # capped (uncapped backoff stalled runs)
            lat = int((time.time() - t0) * 1000)
            if r.status_code in RETRY_STATUS and attempt < N - 1:
                ra = r.headers.get("retry-after")
                try:
                    wait = float(ra) if ra else delay
                except ValueError:
                    wait = delay
                time.sleep(min(max(wait, 2.0 if r.status_code == 429 else 0), 60) + random.random()); delay = min(delay * 2, 30)
                continue
            return r, lat, None
        return None, 0, "retries exhausted"

    def _guard(self, provider):
        if provider in self.disabled:
            raise ProviderDisabled(f"{provider} disabled: {self.disabled[provider]}")

    # ------------------------------------------------------------- anthropic
    def anthropic(self, *, messages, system=None, tools=None, module, item_id, role="target",
                  model=None, params=None):
        self._guard("anthropic")
        tcfg = self.cfg["target"]
        model = model or tcfg["model"]
        params = dict(tcfg["params"] if params is None else params)
        body = {"model": model, "messages": messages, **params}
        if system:
            body["system"] = system
        if tools:
            body["tools"] = tools
        est = self.L.worst_case("anthropic", model, est_tokens(body), params["max_tokens"])
        rid = self.L.reserve(est)
        headers = {"x-api-key": get_key("ANTHROPIC_API_KEY"), "anthropic-version": "2023-06-01",
                   "content-type": "application/json"}
        with self.sem["anthropic"]:
            r, lat, neterr = self._send("anthropic", ANTHROPIC_URL, headers, body)
        log = dict(module=module, item_id=item_id, role=role, provider="anthropic",
                   model_requested=model, prompt_version=self.pv,
                   params_json={k: v for k, v in params.items()}, request_json=body,
                   est_worst_usd=est, latency_ms=lat)
        if r is None or r.status_code != 200:
            err = neterr or f"HTTP {r.status_code}: {redact(r.text[:2000])}"
            if r is not None and r.status_code in (401, 403):
                self.disabled["anthropic"] = f"HTTP {r.status_code}"
            self.L.record(rid, **log, status="error", error=err, cost_usd=0.0,
                          input_tokens=0, output_tokens=0)
            return {"ok": False, "error": err}
        j = r.json()
        u = j.get("usage", {})
        usage = {"input_tokens": u.get("input_tokens", 0), "output_tokens": u.get("output_tokens", 0),
                 "cache_read_tokens": u.get("cache_read_input_tokens") or 0,
                 "cache_write_tokens": u.get("cache_creation_input_tokens") or 0}
        cost = self.L.cost("anthropic", model, usage)
        call_id = self.L.record(rid, **log, model_returned=j.get("model"), status="ok",
                                cost_usd=cost, raw_output_json=j, **usage,
                                provider_request_id=j.get("id"))
        text = "".join(b.get("text", "") for b in j.get("content", []) if b.get("type") == "text")
        thinking = "".join(b.get("thinking", "") for b in j.get("content", []) if b.get("type") == "thinking")
        return {"ok": True, "text": text, "thinking": thinking, "content": j.get("content", []),
                "stop_reason": j.get("stop_reason"), "usage": usage, "cost": cost,
                "model_returned": j.get("model"), "call_id": call_id}

    # ------------------------------------------------------------------ groq
    def groq(self, *, messages, model, params, module, item_id, role, tools=None):
        self._guard("groq")
        body = {"model": model, "messages": messages, **params}
        if tools:
            body["tools"] = tools
        max_out = params.get("max_completion_tokens", 2000)
        est = self.L.worst_case("groq", model, est_tokens(body), max_out)
        rid = self.L.reserve(est)
        headers = {"Authorization": f"Bearer {get_key('GROQ_API_KEY')}", "Content-Type": "application/json"}
        with self.sem["groq"]:
            r, lat, neterr = self._send("groq", GROQ_URL, headers, body)
        log = dict(module=module, item_id=item_id, role=role, provider="groq", model_requested=model,
                   prompt_version=self.pv, params_json=params, request_json=body,
                   est_worst_usd=est, latency_ms=lat)
        if r is None or r.status_code != 200:
            err = neterr or f"HTTP {r.status_code}: {redact(r.text[:2000])}"
            if r is not None and r.status_code in (401, 403):
                self.disabled["groq"] = f"HTTP {r.status_code}"
            self.L.record(rid, **log, status="error", error=err, cost_usd=0.0, input_tokens=0, output_tokens=0)
            return {"ok": False, "error": err}
        j = r.json()
        u = j.get("usage", {})
        usage = {"input_tokens": u.get("prompt_tokens", 0), "output_tokens": u.get("completion_tokens", 0)}
        cost = self.L.cost("groq", model, usage)
        call_id = self.L.record(rid, **log, model_returned=j.get("model"), status="ok", cost_usd=cost,
                                raw_output_json=j, **usage, provider_request_id=j.get("id"))
        msg = j["choices"][0]["message"]
        text = msg.get("content") or ""
        text = re.sub(r"<think>.*?</think>", "", text, flags=re.S).strip()
        return {"ok": True, "text": text, "reasoning": msg.get("reasoning"), "usage": usage,
                "cost": cost, "model_returned": j.get("model"), "call_id": call_id,
                "tool_calls": msg.get("tool_calls") or [], "finish_reason": j["choices"][0].get("finish_reason")}


    # ------------------------------------------------------------ openrouter
    def openrouter(self, *, messages, model, params, module, item_id, role, tools=None):
        """OpenAI-compatible OpenRouter call. Cost = OpenRouter's returned usage.cost when present (actual billed),
        else computed from config/prices.json. Returns the same shape as groq() plus reasoning_details/provider."""
        self._guard("openrouter")
        body = {"model": model, "messages": messages, **params, "usage": {"include": True}}
        if tools:
            body["tools"] = tools
        max_out = params.get("max_tokens", params.get("max_completion_tokens", 2000))
        est = self.L.worst_case("openrouter", model, est_tokens(body), max_out)
        rid = self.L.reserve(est)
        headers = {"Authorization": f"Bearer {get_key('OPENROUTER_API_KEY')}", "Content-Type": "application/json",
                   "X-Title": "moral-gradient-pilot"}
        with self.sem["openrouter"]:
            r, lat, neterr = self._send("openrouter", OPENROUTER_URL, headers, body)
        log = dict(module=module, item_id=item_id, role=role, provider="openrouter", model_requested=model,
                   prompt_version=self.pv, params_json=params, request_json=body, est_worst_usd=est, latency_ms=lat)
        j = None
        if r is not None and r.status_code == 200:
            try:
                j = r.json()
            except ValueError:
                j = None
        if j is None or "choices" not in j or not j["choices"]:
            err = neterr or (f"HTTP {r.status_code}: {redact(r.text[:2000])}" if r is not None else "no response")
            if j is not None and "error" in j:
                err = f"HTTP 200 error: {redact(json.dumps(j['error'])[:2000])}"
            if r is not None and r.status_code in (401, 402, 403):
                self.disabled["openrouter"] = f"HTTP {r.status_code}"
            self.L.record(rid, **log, status="error", error=err, cost_usd=0.0, input_tokens=0, output_tokens=0)
            return {"ok": False, "error": err}
        u = j.get("usage", {}) or {}
        usage = {"input_tokens": u.get("prompt_tokens", 0), "output_tokens": u.get("completion_tokens", 0)}
        cost = u.get("cost")
        cost = float(cost) if isinstance(cost, (int, float)) else self.L.cost("openrouter", model, usage)
        call_id = self.L.record(rid, **log, model_returned=j.get("model"), status="ok", cost_usd=cost,
                                raw_output_json=j, **usage, provider_request_id=j.get("id"),
                                billed_units={"or_cost": u.get("cost"), "provider": j.get("provider"),
                                              "reasoning_tokens": (u.get("completion_tokens_details") or {}).get("reasoning_tokens")})
        ch = j["choices"][0]
        msg = ch.get("message") or {}
        text = msg.get("content") or ""
        return {"ok": True, "text": text, "reasoning": msg.get("reasoning"), "reasoning_details": msg.get("reasoning_details"),
                "usage": usage, "cost": cost, "model_returned": j.get("model"), "provider_served": j.get("provider"),
                "call_id": call_id, "tool_calls": msg.get("tool_calls") or [], "finish_reason": ch.get("finish_reason")}

    # ------------------------------------------------------------------- jev
    def jev(self, *, state, questions, module, item_id, role="grader", model="jev-1.13"):
        self._guard("jev")
        if not JEV_URL or "jev-ai.org" in JEV_URL:
            raise ProviderDisabled("jev endpoint not configured (TypeSafe AI Jev pending)")
        body = {"model": model, "state": state, "questions": questions}
        est = self.L.worst_case("jev", model, est_tokens(body) * 2, 0)  # Jev scaffolding adds input
        rid = self.L.reserve(est)
        headers = {"Authorization": f"Bearer {get_key('JEV_API_KEY')}", "Content-Type": "application/json",
                   "Idempotency-Key": f"mc-{uuid.uuid4().hex}"}
        with self.sem["jev"]:
            r, lat, neterr = self._send("jev", JEV_URL, headers, body, timeout=120)
        log = dict(module=module, item_id=item_id, role=role, provider="jev", model_requested=model,
                   prompt_version=self.pv, params_json={}, request_json=body, est_worst_usd=est,
                   latency_ms=lat)
        if r is None or r.status_code != 200:
            err = neterr or f"HTTP {r.status_code}: {redact(r.text[:2000])}"
            if r is not None and r.status_code in (401, 402, 403):
                self.disabled["jev"] = f"HTTP {r.status_code} ({_code(r)})"
            self.L.record(rid, **log, status="error", error=err, cost_usd=0.0, input_tokens=0, output_tokens=0)
            return {"ok": False, "error": err}
        j = r.json()
        u = j.get("usage", {})
        usage = {"input_tokens": u.get("charged_tokens", u.get("input_tokens", 0)), "output_tokens": 0}
        cost = self.L.cost("jev", model, usage)
        call_id = self.L.record(rid, **log, model_returned=j.get("model_version"), status="ok",
                                cost_usd=cost, raw_output_json=j, input_tokens=u.get("input_tokens", 0),
                                output_tokens=u.get("output_tokens", 0),
                                billed_units={"charged_tokens": u.get("charged_tokens"),
                                              "charged_credits": u.get("charged_credits"),
                                              "wallet": u.get("wallet")},
                                provider_request_id=j.get("id"))
        return {"ok": True, "answers": j.get("answers", {}), "usage": u, "cost": cost,
                "model_returned": j.get("model_version"), "call_id": call_id}


def _code(r):
    try:
        e = r.json().get("error", {})
        return e.get("code") or e.get("type") or "?"
    except Exception:
        return "?"
