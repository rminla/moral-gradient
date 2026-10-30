import fs from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";
import { kvGet } from "./db";
import { getBundle } from "./bundle";
import type { Spend } from "./types";

export type LiveSpend = Spend & { source: "live-ledger" | "ingested" | "bundle"; as_of: string };

/** Live spend straight from the pilot's append-only cost ledger (read-only SELECTs). */
async function readLedger(): Promise<LiveSpend | null> {
  const p = path.resolve(process.cwd(), process.env.LEDGER_PATH || "../pilot/data/ledger.sqlite");
  if (!fs.existsSync(p)) return null;
  const c = createClient({ url: "file:" + p });
  try {
    const one = async (sql: string) => (await c.execute(sql)).rows;
    const [tot] = await one("SELECT COALESCE(SUM(cost_usd),0) AS usd, COUNT(*) AS n, MAX(ts_utc) AS last FROM calls");
    const by_model = (await one("SELECT model_requested AS model, provider, SUM(cost_usd) AS usd, COUNT(*) AS calls FROM calls GROUP BY 1,2 ORDER BY 3 DESC")).map((r) => ({ model: String(r.model), provider: String(r.provider), usd: Number(r.usd), calls: Number(r.calls) }));
    const by_role = (await one("SELECT CASE WHEN role LIKE 'grader%' THEN 'grading' WHEN role='persuader' THEN 'persuader' ELSE 'target model' END AS role, SUM(cost_usd) AS usd FROM calls GROUP BY 1 ORDER BY 2 DESC")).map((r) => ({ role: String(r.role), usd: Number(r.usd) }));
    const runs = (await one("SELECT r.run_id, r.mode, r.started_utc, (SELECT COALESCE(SUM(cost_usd),0) FROM calls c WHERE c.run_id=r.run_id) AS usd FROM runs r ORDER BY r.started_utc DESC LIMIT 25")).map((r) => ({ run_id: String(r.run_id), mode: String(r.mode), started_utc: String(r.started_utc), usd: Number(r.usd) }));
    return { total_usd: Number(tot.usd), calls: Number(tot.n), by_model, by_role, runs, source: "live-ledger", as_of: String(tot.last || new Date().toISOString()) };
  } catch { return null; } finally { c.close(); }
}

export async function getSpend(): Promise<LiveSpend | null> {
  const live = await readLedger();
  if (live) return live;
  const ing = await kvGet<LiveSpend>("spend").catch(() => null);
  if (ing) return { ...ing, source: "ingested" };
  const b = await getBundle();
  return b.spend ? { ...b.spend, source: "bundle", as_of: b.generated_utc } : null;
}
