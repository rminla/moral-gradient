// Write data/spend-snapshot.json: aggregate spend from the pilot cost ledger (read-only SELECTs; no prompts, no keys).
// Production can't see the box ledger, so this committed snapshot keeps /costs current between /api/ingest pushes.
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";

const p = path.resolve(process.cwd(), process.env.LEDGER_PATH || "../pilot/data/ledger.sqlite");
const c = createClient({ url: "file:" + p });
const rows = async (sql) => (await c.execute(sql)).rows;
const [tot] = await rows("SELECT COALESCE(SUM(cost_usd),0) AS usd, COUNT(*) AS n, MAX(ts_utc) AS last FROM calls");
const by_model = (await rows("SELECT model_requested AS model, provider, SUM(cost_usd) AS usd, COUNT(*) AS calls FROM calls GROUP BY 1,2 ORDER BY 3 DESC")).map((r) => ({ model: String(r.model), provider: String(r.provider), usd: Number(r.usd), calls: Number(r.calls) }));
const by_role = (await rows("SELECT CASE WHEN role LIKE 'grader%' THEN 'grading' WHEN role='persuader' THEN 'persuader' ELSE 'target model' END AS role, SUM(cost_usd) AS usd FROM calls GROUP BY 1 ORDER BY 2 DESC")).map((r) => ({ role: String(r.role), usd: Number(r.usd) }));
const runs = (await rows("SELECT r.run_id, r.mode, r.started_utc, (SELECT COALESCE(SUM(cost_usd),0) FROM calls c WHERE c.run_id=r.run_id) AS usd FROM runs r ORDER BY r.started_utc DESC LIMIT 25")).map((r) => ({ run_id: String(r.run_id), mode: String(r.mode), started_utc: String(r.started_utc), usd: Number(r.usd) }));
const out = { total_usd: Number(tot.usd), calls: Number(tot.n), by_model, by_role, runs, as_of: String(tot.last || new Date().toISOString()) };
fs.writeFileSync(path.join(process.cwd(), "data", "spend-snapshot.json"), JSON.stringify(out, null, 1) + "\n");
console.log(`spend snapshot: $${out.total_usd.toFixed(2)} over ${out.calls} calls, as of ${out.as_of}`);
c.close();
