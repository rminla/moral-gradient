"""Per-call ledger (SQLite + JSONL mirror) with live cost and a hard spend cap.

Spend-cap rule: before every billable call we compute a worst-case cost
(estimated input tokens x input price + max output tokens x output price) and
*reserve* it. If committed spend + outstanding reservations + this estimate would
exceed either the pilot cap (all runs in this ledger) or the per-run budget, the
call is refused with BudgetExceeded and never sent. After the call the
reservation is replaced by the actual cost computed from returned usage.
"""
import json
import sqlite3
import threading
import time
import uuid
from datetime import datetime, timezone

from .secrets import redact


class BudgetExceeded(RuntimeError):
    pass


SCHEMA = """
CREATE TABLE IF NOT EXISTS calls (
  call_id TEXT PRIMARY KEY,
  run_id TEXT, ts_utc TEXT, module TEXT, item_id TEXT, role TEXT,
  provider TEXT, model_requested TEXT, model_returned TEXT,
  prompt_version TEXT, params_json TEXT, request_json TEXT,
  input_tokens INTEGER, output_tokens INTEGER, cache_read_tokens INTEGER,
  cache_write_tokens INTEGER, billed_units TEXT,
  cost_usd REAL, est_worst_usd REAL, latency_ms INTEGER,
  status TEXT, error TEXT, raw_output_json TEXT, provider_request_id TEXT
);
CREATE TABLE IF NOT EXISTS runs (
  run_id TEXT PRIMARY KEY, mode TEXT, started_utc TEXT, finished_utc TEXT,
  budget_usd REAL, pilot_cap_usd REAL, config_json TEXT, notes TEXT
);
"""


def utcnow():
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds")


class Ledger:
    def __init__(self, db_path, jsonl_path, prices, pilot_cap_usd, run_budget_usd, run_id):
        self.db_path, self.jsonl_path = db_path, jsonl_path
        self.prices = prices["models"]
        self.pilot_cap = float(pilot_cap_usd)
        self.run_budget = float(run_budget_usd)
        self.run_id = run_id
        self.lock = threading.RLock()
        self.reserved = {}
        self.conn = sqlite3.connect(db_path, check_same_thread=False, timeout=60)  # concurrent runs share the ledger
        self.conn.executescript(SCHEMA)
        self.conn.commit()

    # ---------- pricing ----------
    def price(self, provider, model):
        key = f"{provider}:{model}"
        if key not in self.prices:
            raise KeyError(f"no price for {key}; add it to config/prices.json before calling")
        return self.prices[key]

    def cost(self, provider, model, usage):
        p = self.price(provider, model)
        m = 1e-6
        return (usage.get("input_tokens", 0) * p.get("input", 0) * m
                + usage.get("output_tokens", 0) * p.get("output", 0) * m
                + usage.get("cache_read_tokens", 0) * p.get("cache_read", p.get("input", 0)) * m
                + usage.get("cache_write_tokens", 0) * p.get("cache_write_5m", p.get("input", 0)) * m)

    def worst_case(self, provider, model, est_input_tokens, max_output_tokens):
        p = self.price(provider, model)
        return (est_input_tokens * p.get("input", 0) + max_output_tokens * p.get("output", 0)) * 1e-6

    # ---------- spend ----------
    def spent_total(self):
        with self.lock:
            return self.conn.execute("SELECT COALESCE(SUM(cost_usd),0) FROM calls").fetchone()[0]

    def spent_run(self):
        with self.lock:
            return self.conn.execute("SELECT COALESCE(SUM(cost_usd),0) FROM calls WHERE run_id=?",
                                     (self.run_id,)).fetchone()[0]

    def reserve(self, est_usd):
        with self.lock:
            outstanding = sum(self.reserved.values())
            total = self.spent_total() + outstanding + est_usd
            run = self.spent_run() + outstanding + est_usd
            if total > self.pilot_cap:
                raise BudgetExceeded(f"pilot cap ${self.pilot_cap:.2f} would be exceeded "
                                     f"(committed+reserved+this call worst case = ${total:.4f})")
            if run > self.run_budget:
                raise BudgetExceeded(f"run budget ${self.run_budget:.2f} would be exceeded "
                                     f"(${run:.4f})")
            rid = uuid.uuid4().hex
            self.reserved[rid] = est_usd
            return rid

    def release(self, rid):
        with self.lock:
            self.reserved.pop(rid, None)

    # ---------- logging ----------
    def record(self, rid, **row):
        row.setdefault("call_id", uuid.uuid4().hex)
        row.setdefault("ts_utc", utcnow())
        row["run_id"] = self.run_id
        for k in ("params_json", "request_json", "raw_output_json", "error", "billed_units"):
            if row.get(k) is not None and not isinstance(row[k], str):
                row[k] = json.dumps(row[k], ensure_ascii=False)
            if row.get(k) is not None:
                row[k] = redact(row[k])
        cols = ",".join(row.keys())
        q = ",".join("?" for _ in row)
        with self.lock:
            self.conn.execute(f"INSERT INTO calls ({cols}) VALUES ({q})", tuple(row.values()))
            self.conn.commit()
            self.reserved.pop(rid, None)
            with open(self.jsonl_path, "a") as f:
                f.write(json.dumps(row, ensure_ascii=False) + "\n")
        return row["call_id"]

    def start_run(self, mode, config, notes=""):
        with self.lock:
            self.conn.execute("INSERT INTO runs VALUES (?,?,?,?,?,?,?,?)",
                              (self.run_id, mode, utcnow(), None, self.run_budget, self.pilot_cap,
                               json.dumps(config), notes))
            self.conn.commit()

    def finish_run(self):
        with self.lock:
            self.conn.execute("UPDATE runs SET finished_utc=? WHERE run_id=?", (utcnow(), self.run_id))
            self.conn.commit()

    def summary(self, run_only=True):
        where = "WHERE run_id=?" if run_only else ""
        args = (self.run_id,) if run_only else ()
        with self.lock:
            rows = self.conn.execute(
            f"SELECT role, provider, model_requested, status, COUNT(*), SUM(input_tokens), "
            f"SUM(output_tokens), SUM(cost_usd) FROM calls {where} "
                f"GROUP BY role, provider, model_requested, status ORDER BY role", args).fetchall()
        return rows
