import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { kvGet } from "./db";
import type { Bundle, Trace } from "./types";

const SAMPLE = path.join(process.cwd(), "data", "sample-bundle.json");
const SAMPLE_TRACES = path.join(process.cwd(), "data", "sample-traces.json");
const SITE_BUNDLE = path.join(process.cwd(), "data", "site-bundle.json");
const SITE_TRACES = path.join(process.cwd(), "data", "site-traces.json");
const resultsDir = () => path.resolve(process.cwd(), process.env.RESULTS_DIR || "../results");

function readJson<T>(p: string): T | null {
  try { return fs.existsSync(p) ? (JSON.parse(fs.readFileSync(p, "utf8")) as T) : null; } catch { return null; }
}

/** Hold-out guard: whatever the producer sends, nothing marked holdout is ever rendered. */
function stripHoldout(b: Bundle): Bundle {
  const hold = new Set(b.scenarios.filter((s) => s.split === "holdout").map((s) => s.id));
  const ok = (id?: string) => !id || !hold.has(id);
  return {
    ...b,
    scenarios: b.scenarios.filter((s) => s.split !== "holdout"),
    saydo: b.saydo.filter((x) => ok(x.scenario)),
    selfinterest: b.selfinterest.filter((x) => ok(x.scenario)),
    pressure: b.pressure.filter((x) => ok(x.item) && (x as any).split !== "holdout"),
    baseline: b.baseline.filter((x) => ok(x.item) && (x as any).split !== "holdout"),
    findings: b.findings.filter((x) => ok(x.scenario)),
  };
}

/**
 * On the box: when RESULTS_DIR/public/index.json is newer than data/site-bundle.json, re-run the adapter
 * (scripts/build_site_bundle.py) so the site always reflects the latest export. No shell; failures are non-fatal.
 */
let lastCheck = 0;
function refreshFromResults() {
  if (Date.now() - lastCheck < 15_000) return;
  lastCheck = Date.now();
  try {
    const idx = path.join(resultsDir(), "public", "index.json");
    if (!fs.existsSync(idx)) return;
    const src = fs.statSync(idx).mtimeMs;
    const dst = fs.existsSync(SITE_BUNDLE) ? fs.statSync(SITE_BUNDLE).mtimeMs : 0;
    if (src > dst) execFileSync("python3", [path.join(process.cwd(), "scripts", "build_site_bundle.py")], { stdio: "ignore", timeout: 60_000, env: { ...process.env, RESULTS_DIR: resultsDir() } });
  } catch { /* keep serving the last good bundle */ }
}

/** Priority: bundle pushed to /api/ingest (production) > adapter output of RESULTS_DIR (box) > example bundle. */
export async function getBundle(): Promise<Bundle> {
  const ingested = await kvGet<Bundle>("bundle").catch(() => null);
  if (!ingested) refreshFromResults();
  const b = ingested || readJson<Bundle>(SITE_BUNDLE) || readJson<Bundle>(SAMPLE);
  if (!b) throw new Error("No results bundle found");
  return stripHoldout({ ...b, findings: b.findings ?? [], pressure: b.pressure ?? [], baseline: b.baseline ?? [], selfinterest: b.selfinterest ?? [], saydo: b.saydo ?? [], spend: b.spend ?? null });
}

/** Restricted: only call from server code after checking donor access. */
export async function getTraces(scenario: string): Promise<{ is_example: boolean; traces: Trace[] }> {
  const ingested = await kvGet<any>("traces").catch(() => null);
  const t = ingested || readJson<any>(SITE_TRACES) || readJson<any>(SAMPLE_TRACES) || { traces: {} };
  const b = await getBundle();
  if (!b.scenarios.some((s) => s.id === scenario)) return { is_example: !!t.is_example, traces: [] }; // unknown or hold-out
  return { is_example: !!t.is_example, traces: ((t.traces || {})[scenario] || []).filter((x: Trace) => x.split !== "holdout" && x.validity !== "excluded").sort((a: Trace, z: Trace) => Number(a.validity === "superseded") - Number(z.validity === "superseded")) };
}

export const pct = (v: number | null | undefined, d = 0) => (v == null ? "–" : `${(v * 100).toFixed(d)}%`);
export const modelName = (b: Bundle, id: string) => b.models.find((m) => m.model_id === id || m.slug === id)?.name || id;
export const scenarioTitle = (b: Bundle, id: string) => b.scenarios.find((s) => s.id === id)?.title || id;
