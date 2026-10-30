import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { jobMode } from "./config";
import { newId, nowIso, q } from "./db";

export type MilestoneRow = {
  id: number; key: string; position: number; kind: string; title: string; lab: string | null; model_id: string | null;
  provider: string | null; suite: string; cost_cents: number; funded_cents: number; status: string; funded_at: string | null; job_id: string | null;
};

/** Split a command template into argv WITHOUT a shell, substituting placeholders. */
function buildArgv(tpl: string, vars: Record<string, string>): string[] {
  const parts = tpl.match(/"[^"]*"|'[^']*'|\S+/g) || [];
  return parts.map((p) => p.replace(/^["']|["']$/g, "").replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? ""));
}

/**
 * Job hook: launch the suite for a fully-funded milestone with a HARD spend cap equal to the funded amount.
 * Modes: dryrun (record only), command (spawn the pilot runner on the same machine), webhook (POST to a runner).
 * Never logs secrets: env is passed through to the child but never printed or stored.
 */
/** The runner gets the box environment minus the site's own secrets (payments, sessions, email, DB). */
function runnerEnv() {
  const drop = /^(STRIPE_|SESSION_SECRET|RESEND_|DATABASE_AUTH_TOKEN|JOB_WEBHOOK_TOKEN)/;
  return Object.fromEntries(Object.entries(process.env).filter(([k]) => !drop.test(k))) as NodeJS.ProcessEnv;
}

export async function launchSuite(m: MilestoneRow): Promise<{ jobId: string; status: string }> {
  const capUsd = Math.round(m.funded_cents) / 100;
  const mode = jobMode();
  const jobId = newId("job_");
  const vars = { model: m.model_id || "ALL_PUBLISHED", suite: m.suite, budget: capUsd.toFixed(2), milestone: m.key, job: jobId };
  const tpl = process.env.JOB_RUNNER_CMD || "python3 ../pilot/run_suite.py --model {model} --suite {suite} --budget {budget} --milestone {milestone}";
  let status = "dry_run";
  let detail = "";

  if (mode === "dryrun") {
    detail = `DRY RUN (JOB_RUNNER_MODE=dryrun): would run \`${buildArgv(tpl, vars).join(" ")}\` with hard cap $${capUsd.toFixed(2)}. Nothing was sent to any model provider.`;
  } else if (mode === "command") {
    const argv = buildArgv(tpl, vars);
    const logDir = path.join(process.cwd(), "data", "jobs");
    fs.mkdirSync(logDir, { recursive: true });
    const out = fs.openSync(path.join(logDir, `${jobId}.log`), "a");
    try {
      const child = spawn(argv[0], argv.slice(1), { cwd: process.cwd(), detached: true, stdio: ["ignore", out, out], env: { ...runnerEnv(), MC_JOB_ID: jobId, MC_BUDGET_USD: vars.budget, MC_CALLBACK_URL: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/jobs/${jobId}` } });
      child.unref();
      status = "started";
      detail = `Spawned pid ${child.pid}: ${argv.join(" ")} (log data/jobs/${jobId}.log)`;
    } catch (e: any) {
      status = "failed";
      detail = `spawn failed: ${e?.message || e}`;
    }
  } else {
    try {
      const res = await fetch(process.env.JOB_WEBHOOK_URL!, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${process.env.JOB_WEBHOOK_TOKEN || ""}` },
        body: JSON.stringify({ job_id: jobId, milestone: m.key, model_id: m.model_id, provider: m.provider, suite: m.suite, budget_usd: capUsd }),
      });
      status = res.ok ? "dispatched" : "failed";
      detail = `webhook HTTP ${res.status}`;
    } catch (e: any) {
      status = "failed";
      detail = `webhook error: ${e?.message || e}`;
    }
  }
  await q("INSERT INTO jobs (id, milestone_id, created_at, cap_usd, mode, status, detail) VALUES (?,?,?,?,?,?,?)", [jobId, m.id, nowIso(), capUsd, mode, status, detail]);
  await q("UPDATE milestones SET status=?, job_id=? WHERE id=?", [status === "failed" ? "launch_failed" : status === "dry_run" ? "funded" : "running", jobId, m.id]);
  return { jobId, status };
}
