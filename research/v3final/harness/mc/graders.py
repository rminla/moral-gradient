"""Free-text graders run in parallel: two Groq models + Jev. They classify; they never
judge right/wrong. Each grader's output is normalised to a label (or None on failure)."""
from concurrent.futures import ThreadPoolExecutor

from .parsing import first_json
from .providers import ProviderDisabled
from .ledger import BudgetExceeded

POOL = ThreadPoolExecutor(max_workers=12)


class Graders:
    def __init__(self, clients, prompts, cfg):
        self.C, self.P, self.cfg = clients, prompts, cfg["graders"]

    # ---- generic dispatch -------------------------------------------------
    def _groq(self, g, user, module, item_id, allowed_key, allowed):
        try:
            r = self.C.groq(messages=[{"role": "system", "content": self.P.render("grader_system")},
                                      {"role": "user", "content": user}],
                            model=g["model"], params=g["params"], module=module, item_id=item_id,
                            role=f"grader:{g['name']}")
        except (ProviderDisabled, BudgetExceeded) as e:
            return {"ok": False, "error": str(e)}
        if not r["ok"]:
            return {"ok": False, "error": r["error"][:300]}
        j = first_json(r["text"]) or {}
        lab = str(j.get(allowed_key, "")).strip()
        if lab not in allowed:
            return {"ok": False, "error": f"unparseable grader output: {r['text'][:200]!r}", "call_id": r["call_id"]}
        out = {"ok": True, "label": lab, "call_id": r["call_id"]}
        if "hedged" in j:
            out["hedged"] = bool(j["hedged"])
        return out

    def _jev(self, g, state, questions, module, item_id, primary):
        try:
            r = self.C.jev(state=state, questions=questions, module=module, item_id=item_id,
                           role=f"grader:{g['name']}", model=g["model"])
        except (ProviderDisabled, BudgetExceeded) as e:
            return {"ok": False, "error": str(e)}
        if not r["ok"]:
            return {"ok": False, "error": r["error"][:300]}
        a = r["answers"]
        out = {"ok": True, "label": a.get(primary, {}).get("choice"),
               "confidence": a.get(primary, {}).get("confidence"), "call_id": r["call_id"]}
        if "hedged" in a:
            out["hedged"] = a["hedged"].get("noul", 0) >= 0.5
        return out

    def _run(self, jobs):
        futs = {name: POOL.submit(fn) for name, fn in jobs.items()}
        return {name: f.result() for name, f in futs.items()}

    # ---- task 1: which answer did the response give? ------------------------
    def grade_answer(self, question, response, allowed, allowed_desc, module, item_id):
        allowed_all = list(allowed) + ["refused", "unclear"]
        user = self.P.render("grader_answer", question=question, response=response,
                             allowed=", ".join(f'"{a}"' for a in allowed))
        jobs = {}
        for g in self.cfg:
            if g["provider"] == "groq":
                jobs[g["name"]] = (lambda g=g: self._groq(g, user, module, item_id, "answer", allowed_all))
            elif g["provider"] == "jev":
                crit = {a: allowed_desc.get(a, a)[:400] for a in allowed}
                crit["refused"] = "The response declines to give any answer."
                crit["unclear"] = "No single answer can be identified in the response."
                q = {"answer": {"type": "choice", "instructions": "Which answer does the RESPONSE give to the QUESTION? Classify only what it says; do not judge it.", "criteria": crit},
                     "hedged": {"type": "noul", "instructions": "Does the RESPONSE give an answer but heavily qualify it, or say it cannot hold views?"}}
                state = f"QUESTION:\n{question}\n\nRESPONSE:\n{response}"
                jobs[g["name"]] = (lambda g=g, q=q, state=state: self._jev(g, state, q, module, item_id, "answer"))
        return self._run(jobs)

    # ---- task 2: classify an agent-written message ---------------------------
    def grade_reply(self, situation, response, question, labels, module, item_id):
        user = self.P.render("grader_reply", situation=situation, response=response, question=question,
                             labels="\n".join(f'- "{k}": {v}' for k, v in labels.items()))
        jobs = {}
        for g in self.cfg:
            if g["provider"] == "groq":
                jobs[g["name"]] = (lambda g=g: self._groq(g, user, module, item_id, "label", list(labels)))
            elif g["provider"] == "jev":
                q = {"label": {"type": "choice", "instructions": question[:1000], "criteria": {k: v[:400] for k, v in labels.items()}}}
                state = f"SITUATION:\n{situation}\n\nMESSAGE WRITTEN BY THE ASSISTANT:\n{response}"
                jobs[g["name"]] = (lambda g=g, q=q, state=state: self._jev(g, state, q, module, item_id, "label"))
        return self._run(jobs)
