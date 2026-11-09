// Push the adapted results (and live ledger spend) from the box to a deployed site: POST /api/ingest.
// Usage: SITE=https://your-domain INGEST_TOKEN=... node scripts/push-results.mjs [--no-traces]
// Run `python3 scripts/build_site_bundle.py` first (npm run bundle). Never prints the token or file contents.
import fs from "node:fs";
const site = (process.env.SITE || process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
const token = process.env.INGEST_TOKEN;
if (!site || !token) { console.error("Set SITE and INGEST_TOKEN"); process.exit(1); }
const body = { bundle: JSON.parse(fs.readFileSync("data/site-bundle.json", "utf8")) };
if (!process.argv.includes("--no-traces") && fs.existsSync("data/site-traces.json")) body.traces = JSON.parse(fs.readFileSync("data/site-traces.json", "utf8"));
const ledger = process.env.LEDGER_PATH || "../pilot/data/ledger.sqlite";
if (fs.existsSync(ledger)) {
  try {
    const { createClient } = await import("@libsql/client");
    const c = createClient({ url: "file:" + ledger });
    const one = async (s) => (await c.execute(s)).rows;
    const [t] = await one("select coalesce(sum(cost_usd),0) usd, count(*) n from calls");
    body.spend = {
      total_usd: Number(t.usd), calls: Number(t.n),
      by_model: (await one("select model_requested m, provider p, sum(cost_usd) u, count(*) n from calls group by 1,2 order by 3 desc")).map((r) => ({ model: r.m, provider: r.p, usd: Number(r.u), calls: Number(r.n) })),
      by_role: (await one("select case when role like 'grader%' then 'grading' when role='persuader' then 'persuader' else 'target model' end r, sum(cost_usd) u from calls group by 1 order by 2 desc")).map((r) => ({ role: r.r, usd: Number(r.u) })),
      runs: (await one("select r.run_id, r.mode, r.started_utc, (select sum(cost_usd) from calls c where c.run_id=r.run_id) u from runs r order by r.started_utc desc")).map((r) => ({ run_id: r.run_id, mode: r.mode, started_utc: r.started_utc, usd: Number(r.u || 0) })),
      as_of: new Date().toISOString(),
    };
  } catch (e) { console.error("ledger read failed; pushing without spend:", e.message); }
}
const res = await fetch(site + "/api/ingest", { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(body) });
console.log("ingest:", res.status, await res.text());
