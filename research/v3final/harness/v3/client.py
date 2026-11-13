"""v3 provider-agnostic model client. One class for every model in v3/registry.json.

Messages use one internal format (Anthropic-style content blocks: text / thinking / tool_use / tool_result);
the client converts to the provider's wire format (api = "anthropic" or "openai"-compatible).
Handles: per-model RPM / output-tokens-per-minute throttles, 429 + rate-limit headers (retry-after,
x-ratelimit-reset-*, X-RateLimit-Reset epoch-ms, "try again in 7.6s" in the body) with a shared per-model
cooldown, capped exponential backoff on 5xx/network errors, tool-call parse failures (resample, then
recover the call from the provider's failed_generation or from text), reasoning tokens (stored; Gemini/
OpenRouter reasoning_details passed back on assistant turns), output caps (truncation flagged and retried
once with a larger cap). Every call is reserved/recorded in the ledger (hard spend caps)."""
import json, random, re, threading, time, uuid
from collections import deque
from pathlib import Path
import requests
from mc.ledger import BudgetExceeded
from mc.secrets import get_key, redact

ROOT = Path(__file__).resolve().parent.parent
REG = json.loads((ROOT / "v3" / "registry.json").read_text())
MODELS = {m["name"]: m for m in REG["models"]}
RETRY = {429, 500, 502, 503, 504, 529}
PARSE_FAIL = ("tool_use_failed", "output_parse_failed", "Failed to parse tool call", "failed_generation")

def prices():
    return {"models": {f"{m['provider']}:{m['model']}": m["price"] for m in REG["models"]}}

def est_tokens(obj): return int(len(json.dumps(obj, ensure_ascii=False)) / 3.2) + 64

def _dur(s):
    """'7.66s' / '1m2.5s' / '250ms' / '3' -> seconds."""
    if s is None: return None
    s = str(s).strip()
    try: return float(s)
    except ValueError: pass
    t = 0.0
    for v, u in re.findall(r"([\d.]+)\s*(ms|s|m|h)", s):
        t += float(v) * {"ms": 0.001, "s": 1, "m": 60, "h": 3600}[u]
    return t or None

class _Bucket:
    """Per-model throttle shared by all threads: sliding-window RPM, output-tokens/min, and a cooldown."""
    def __init__(self, rpm=None, otpm=None):
        self.rpm, self.otpm, self.lock = rpm, otpm, threading.Lock()
        self.req, self.tok, self.cool = deque(), deque(), 0.0
    def wait(self, expect_out=0):
        while True:
            with self.lock:
                now = time.time()
                while self.req and now - self.req[0] > 60: self.req.popleft()
                while self.tok and now - self.tok[0][0] > 60: self.tok.popleft()
                w = max(0.0, self.cool - now)
                if not w and self.rpm and len(self.req) >= self.rpm: w = 60 - (now - self.req[0]) + 0.05
                if not w and self.otpm and sum(t for _, t in self.tok) + expect_out > self.otpm and self.tok: w = 60 - (now - self.tok[0][0]) + 0.05
                if not w: self.req.append(now); return
            time.sleep(min(w, 30) + random.random() * 0.3)
    def used(self, out_tokens):
        with self.lock: self.tok.append((time.time(), out_tokens))
    def cooldown(self, sec):
        with self.lock: self.cool = max(self.cool, time.time() + sec)

_BUCKETS, _SEMS, _BL = {}, {}, threading.Lock()
_TL = threading.local()
def _session():
    if not hasattr(_TL, "s"): _TL.s = requests.Session()
    return _TL.s

class ModelClient:
    def __init__(self, name, ledger, role="target", max_out=None):
        self.m = MODELS[name]; self.name = name; self.L = ledger; self.role = role
        self.p = REG["providers"][self.m["provider"]]
        self.max_out = max_out or (REG["grading"]["grader_max_out"] if role == "grader" else self.m.get("max_out", 8000))
        self.params = dict(self.m.get("grader_params" if role == "grader" else "params", {}) or {})
        with _BL:
            self.bucket = _BUCKETS.setdefault(name, _Bucket(self.m.get("rpm"), self.m.get("otpm")))
            self.sem = _SEMS.setdefault(self.m["provider"], threading.BoundedSemaphore(self.p.get("concurrency", 8)))
        self.stats = {"parse_retries": 0, "tool_from_text": 0, "truncated": 0, "rate_limited": 0}

    # ---------------------------------------------------------------- public
    def chat(self, messages, system=None, tools=None, *, module, item_id, role=None):
        """Returns {ok, text, thinking, content(blocks), tool_uses[{id,name,input}], cost, truncated, finish, model_returned, error}."""
        cap = self.max_out; last = None
        for attempt in range(6):
            r = self._call(messages, system, tools, module, item_id, role or self.role, cap)
            last = r
            if not r["ok"] and any(k in r.get("error", "") for k in PARSE_FAIL):
                self.stats["parse_retries"] += 1
                rec = self._recover_failed_generation(r.get("error", ""), tools)
                if rec and attempt >= 2: return rec       # resampled 3x already: recover the call the model tried to make
                continue
            if r["ok"] and r["truncated"] and not r["text"].strip() and not r["tool_uses"] and cap < 2 * self.max_out:
                cap = 2 * self.max_out; self.stats["truncated"] += 1; continue   # empty truncated answer: one retry with a larger cap
            return r
        return last

    # ---------------------------------------------------------------- wire
    def _call(self, messages, system, tools, module, item_id, role, cap):
        api = self.p["api"]
        if api == "anthropic":
            body = {"model": self.m["model"], "max_tokens": cap, "messages": messages, **self.params}
            if system: body["system"] = system
            if tools: body["tools"] = tools
            headers = {"x-api-key": get_key(self.p["key_env"]), "anthropic-version": "2023-06-01", "content-type": "application/json"}
        else:
            body = {"model": self.m["model"], "messages": self._to_oai(messages, system), self.p.get("max_tokens_field", "max_tokens"): cap,
                    **self.params, **self.p.get("extra_body", {})}
            if tools: body["tools"] = [{"type": "function", "function": {"name": t["name"], "description": t["description"], "parameters": t["input_schema"]}} for t in tools]
            headers = {"Authorization": f"Bearer {get_key(self.p['key_env'])}", "Content-Type": "application/json"}
        est = self.L.worst_case(self.m["provider"], self.m["model"], est_tokens(body), cap)
        rid = self.L.reserve(est)          # raises BudgetExceeded before anything is sent
        log = dict(module=module, item_id=item_id, role=role, provider=self.m["provider"], model_requested=self.m["model"],
                   prompt_version="v3", params_json=self.params, request_json=body, est_worst_usd=est)
        try:
            resp, lat, neterr = self._send(body, headers, cap)
        except BaseException:
            self.L.release(rid); raise
        log["latency_ms"] = lat
        j = None
        if resp is not None and resp.status_code == 200:
            try: j = resp.json()
            except ValueError: j = None
        bad = j is None or (api == "openai" and not j.get("choices"))
        if bad:
            err = neterr or (f"HTTP {resp.status_code}: {redact(resp.text[:3000])}" if resp is not None else "no response")
            if j is not None and "error" in j: err = f"HTTP 200 error: {redact(json.dumps(j['error'])[:3000])}"
            self.L.record(rid, **log, status="error", error=err, cost_usd=0.0, input_tokens=0, output_tokens=0)
            return {"ok": False, "error": err}
        return self._parse(j, rid, log, tools)

    def _send(self, body, headers, cap):
        delay = 2.0
        for attempt in range(14):
            self.bucket.wait(expect_out=min(cap, 3000))
            t0 = time.time()
            try:
                with self.sem:
                    r = _session().post(self.p["url"], headers=headers, json=body, timeout=(10, 240))
            except requests.RequestException as e:
                if attempt == 13: return None, int((time.time() - t0) * 1000), f"network: {type(e).__name__}"
                time.sleep(delay + random.random()); delay = min(delay * 2, 30); continue
            lat = int((time.time() - t0) * 1000)
            if r.status_code in RETRY and attempt < 13:
                w = self._ratelimit_wait(r) if r.status_code == 429 else None
                if r.status_code == 429:
                    self.stats["rate_limited"] += 1; w = max(w or delay, 2.0); self.bucket.cooldown(w)
                else: w = delay
                time.sleep(min(w, 90) + random.random()); delay = min(delay * 2, 30); continue
            self._read_headers(r)
            return r, lat, None
        return None, 0, "retries exhausted"

    def _ratelimit_wait(self, r):
        h = {k.lower(): v for k, v in r.headers.items()}
        for k in ("retry-after", "x-ratelimit-reset-tokens", "x-ratelimit-reset-requests"):
            if _dur(h.get(k)): return _dur(h.get(k))
        if h.get("x-ratelimit-reset"):
            try:
                v = float(h["x-ratelimit-reset"]); return max(0.5, v / 1000 - time.time()) if v > 1e11 else v
            except ValueError: pass
        m = re.search(r"try again in ([\dms.]+)", r.text or "")
        return _dur(m.group(1)) if m else None

    def _read_headers(self, r):
        """Proactive: if the provider says we are nearly out of tokens/requests for this window, cool down until reset."""
        h = {k.lower(): v for k, v in r.headers.items()}
        for rem, rst in (("x-ratelimit-remaining-tokens", "x-ratelimit-reset-tokens"), ("x-ratelimit-remaining-requests", "x-ratelimit-reset-requests")):
            try:
                if h.get(rem) is not None and float(h[rem]) <= 1 and _dur(h.get(rst)): self.bucket.cooldown(_dur(h[rst]))
            except ValueError: pass

    # ---------------------------------------------------------------- formats
    def _to_oai(self, messages, system):
        out = [{"role": "system", "content": system}] if system else []
        for m in messages:
            c = m["content"]
            if isinstance(c, str): out.append({"role": m["role"], "content": c}); continue
            if m["role"] == "assistant":
                txt = "".join(b.get("text", "") for b in c if b.get("type") == "text")
                msg = {"role": "assistant", "content": txt or ""}
                tcs = [{"id": b["id"], "type": "function", "function": {"name": b["name"], "arguments": json.dumps(b["input"])}} for b in c if b.get("type") == "tool_use"]
                if tcs: msg["tool_calls"] = tcs
                rd = [d for b in c if b.get("type") == "thinking" for d in (b.get("reasoning_details") or [])]
                if rd: msg["reasoning_details"] = rd
                out.append(msg)
            else:
                for b in c:
                    if b.get("type") == "tool_result": out.append({"role": "tool", "tool_call_id": b["tool_use_id"], "content": b["content"]})
                    elif b.get("type") == "text": out.append({"role": "user", "content": b["text"]})
        return out

    def _parse(self, j, rid, log, tools):
        prov = self.m["provider"]; tnames = {t["name"] for t in (tools or [])}
        if self.p["api"] == "anthropic":
            u = j.get("usage", {})
            usage = {"input_tokens": u.get("input_tokens", 0), "output_tokens": u.get("output_tokens", 0),
                     "cache_read_tokens": u.get("cache_read_input_tokens") or 0, "cache_write_tokens": u.get("cache_creation_input_tokens") or 0}
            cost = self.L.cost(prov, self.m["model"], usage); content = j.get("content", [])
            finish = j.get("stop_reason"); billed = None
        else:
            u = j.get("usage", {}) or {}
            usage = {"input_tokens": u.get("prompt_tokens", 0), "output_tokens": u.get("completion_tokens", 0)}
            cost = u.get("cost") if self.p.get("billed_cost") and isinstance(u.get("cost"), (int, float)) else self.L.cost(prov, self.m["model"], usage)
            billed = {"reasoning_tokens": (u.get("completion_tokens_details") or {}).get("reasoning_tokens"), "provider": j.get("provider"), "billed_cost": u.get("cost")}
            ch = j["choices"][0]; msg = ch.get("message") or {}; finish = ch.get("finish_reason")
            text = re.sub(r"<think>.*?</think>", "", msg.get("content") or "", flags=re.S).strip()
            content = []
            if msg.get("reasoning") or msg.get("reasoning_details"):
                content.append({"type": "thinking", "thinking": msg.get("reasoning") or "", "reasoning_details": msg.get("reasoning_details")})
            if text: content.append({"type": "text", "text": text})
            for tc in msg.get("tool_calls") or []:
                content.append({"type": "tool_use", "id": tc.get("id") or "call_" + uuid.uuid4().hex[:8], "name": tc["function"]["name"], "input": _args(tc["function"].get("arguments"))})
        self.bucket.used(usage["output_tokens"])
        call_id = self.L.record(rid, **log, model_returned=j.get("model"), status="ok", cost_usd=cost, raw_output_json=j, **usage,
                                provider_request_id=j.get("id"), billed_units=billed)
        text = "".join(b.get("text", "") for b in content if b.get("type") == "text")
        uses = [b for b in content if b.get("type") == "tool_use"]
        from_text = False
        if tools and not uses and text:            # fallback: tool call written as text (<tool_call>{...}</tool_call> or bare JSON)
            for name, inp in _calls_in_text(text, tnames):
                b = {"type": "tool_use", "id": "call_" + uuid.uuid4().hex[:8], "name": name, "input": inp}
                content.append(b); uses.append(b); from_text = True
            if from_text: self.stats["tool_from_text"] += 1
        return {"ok": True, "text": text, "thinking": "".join(b.get("thinking", "") for b in content if b.get("type") == "thinking"),
                "content": content, "tool_uses": uses, "cost": cost, "usage": usage, "finish": finish,
                "truncated": finish in ("length", "max_tokens"), "tool_from_text": from_text, "model_returned": j.get("model"), "call_id": call_id}

    def _recover_failed_generation(self, err, tools):
        if not tools: return None
        m = re.search(r'"failed_generation"\s*:\s*"((?:[^"\\]|\\.)*)"', err)
        if not m: return None
        try: gen = json.loads('"' + m.group(1) + '"')
        except ValueError: return None
        calls = list(_calls_in_text(gen, {t["name"] for t in tools}))
        if not calls: return None
        content = [{"type": "tool_use", "id": "call_" + uuid.uuid4().hex[:8], "name": n, "input": i} for n, i in calls]
        self.stats["tool_from_text"] += 1
        return {"ok": True, "text": "", "thinking": "", "content": content, "tool_uses": content, "cost": 0.0, "usage": {}, "finish": "recovered",
                "truncated": False, "tool_from_text": True, "model_returned": self.m["model"], "call_id": None}

def _args(a):
    if isinstance(a, dict): return a
    try: return json.loads(a or "{}")
    except (json.JSONDecodeError, TypeError):
        m = re.search(r"\{.*\}", a or "", re.S)
        if m:
            try: return json.loads(re.sub(r",\s*([}\]])", r"\1", m.group(0)))
            except json.JSONDecodeError: pass
        return {"_unparsed": a}

def _calls_in_text(text, names):
    """Yield (name, input) for tool calls a model wrote as text instead of using native function calling."""
    for blob in re.findall(r"<tool_call>\s*(\{.*?\})\s*</tool_call>", text, re.S) or re.findall(r"\{[^{}]*\"name\"\s*:\s*\"[a-z_]+\"[^{}]*(?:\{[^{}]*\}[^{}]*)?\}", text):
        try: d = json.loads(blob)
        except json.JSONDecodeError: continue
        n = d.get("name") or d.get("tool")
        if n in names: yield n, _args(d.get("arguments", d.get("parameters", d.get("input", {}))))
