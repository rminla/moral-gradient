import fs from "node:fs";
import path from "node:path";
import { autoLaunch } from "./config";
import { db, nowIso, q } from "./db";
import { launchSuite, type MilestoneRow } from "./jobs";

/** Donations paid directly (not through Stripe), from data/offline-donations.json. They count toward totals and the
 *  leaderboard, but are already spent (methodology development compute), so they never enter the pool or trigger a launch. */
export type OfflineDonation = { id: string; name: string; amount_cents: number; paid_at: string; message?: string | null; covers?: string | null };
export function getOfflineDonations(): OfflineDonation[] {
  try {
    const p = path.join(process.cwd(), "data", "offline-donations.json");
    if (!fs.existsSync(p)) return [];
    const j = JSON.parse(fs.readFileSync(p, "utf8"));
    return (Array.isArray(j.donations) ? j.donations : []).filter((d: any) => d && d.name && Number(d.amount_cents) > 0);
  } catch { return []; }
}

export type Funding = {
  raised_cents: number; fees_cents: number; net_cents: number; donors: number; donations: number;
  direct_cents: number; // offline donations, already spent on methodology development compute
  allocated_cents: number; pool_cents: number; has_examples: boolean;
  next: (MilestoneRow & { remaining_cents: number; progress: number }) | null;
  queue: MilestoneRow[]; done: MilestoneRow[];
};

export async function getFunding(): Promise<Funding> {
  const [d] = await q<any>(`SELECT COALESCE(SUM(amount_cents),0) AS raised, COALESCE(SUM(fee_cents),0) AS fees, COALESCE(SUM(net_cents),0) AS net,
     COUNT(*) AS n, COUNT(DISTINCT COALESCE(user_id, email, id)) AS donors, MAX(is_example) AS ex FROM donations WHERE status='paid'`);
  const ms = await q<MilestoneRow>("SELECT * FROM milestones ORDER BY position");
  const allocated = ms.reduce((s, m) => s + Number(m.funded_cents), 0);
  const queue = ms.filter((m) => m.status === "queued");
  const done = ms.filter((m) => m.status !== "queued");
  const n = queue[0];
  const off = getOfflineDonations();
  const direct = off.reduce((s, x) => s + Number(x.amount_cents), 0);
  return {
    raised_cents: Number(d.raised) + direct, fees_cents: Number(d.fees), net_cents: Number(d.net) + direct, donations: Number(d.n) + off.length,
    donors: Number(d.donors) + new Set(off.map((x) => x.name)).size, direct_cents: direct,
    allocated_cents: allocated, pool_cents: Number(d.net) - allocated, has_examples: Number(d.ex) === 1,
    next: n ? { ...n, remaining_cents: Number(n.cost_cents) - Number(n.funded_cents), progress: Number(n.funded_cents) / Number(n.cost_cents) } : null,
    queue, done,
  };
}

/**
 * Pour unallocated net donations into the queue, in order. Any milestone that reaches 100% is marked funded and
 * (if AUTO_LAUNCH) its suite is launched immediately with a hard cap = funded amount, then the bar advances.
 * When the queue is empty, money simply stays in the general pool for the next model.
 */
export async function allocateAndLaunch(): Promise<{ funded: string[]; launched: { key: string; job: string; status: string }[] }> {
  const c = await db();
  const tx = await c.transaction("write");
  const newlyFunded: MilestoneRow[] = [];
  try {
    const net = Number((await tx.execute("SELECT COALESCE(SUM(net_cents),0) AS v FROM donations WHERE status='paid'")).rows[0].v);
    const alloc = Number((await tx.execute("SELECT COALESCE(SUM(funded_cents),0) AS v FROM milestones")).rows[0].v);
    let avail = net - alloc;
    const queue = (await tx.execute("SELECT * FROM milestones WHERE status='queued' ORDER BY position")).rows.map((r) => ({ ...r }) as any as MilestoneRow);
    for (const m of queue) {
      if (avail <= 0) break;
      const need = Number(m.cost_cents) - Number(m.funded_cents);
      const add = Math.min(avail, need);
      const funded = Number(m.funded_cents) + add;
      avail -= add;
      const complete = funded >= Number(m.cost_cents);
      await tx.execute({ sql: "UPDATE milestones SET funded_cents=?, status=?, funded_at=? WHERE id=?", args: [funded, complete ? "funded" : "queued", complete ? nowIso() : null, m.id] });
      if (complete) newlyFunded.push({ ...m, funded_cents: funded, status: "funded" });
    }
    await tx.commit();
  } catch (e) {
    await tx.rollback();
    throw e;
  } finally {
    tx.close();
  }
  const launched: { key: string; job: string; status: string }[] = [];
  if (autoLaunch()) {
    for (const m of newlyFunded) {
      const r = await launchSuite(m);
      launched.push({ key: m.key, job: r.jobId, status: r.status });
    }
  }
  return { funded: newlyFunded.map((m) => m.key), launched };
}

/** Shared by the Stripe webhook and the mock checkout. Idempotent per donation. */
export async function markDonationPaid(id: string, info: { amount_cents: number; fee_cents?: number; fee_is_estimate?: boolean; email?: string | null; payment_id?: string | null }) {
  const rows = await q<any>("SELECT * FROM donations WHERE id=?", [id]);
  const d = rows[0];
  if (!d || d.status === "paid") return { already: true };
  const fee = info.fee_cents ?? Math.round(info.amount_cents * 0.029 + 30);
  const email = (info.email || d.email || "").toLowerCase() || null;
  let userId = d.user_id as string | null;
  if (!userId && email) {
    // Link the donation to an account by email so the donor can sign in with a magic link and see traces.
    const u = await q<any>("SELECT id FROM users WHERE email=?", [email]);
    userId = u[0]?.id || null;
    if (!userId) {
      userId = "usr_" + crypto.randomUUID().replace(/-/g, "").slice(0, 16);
      await q("INSERT INTO users (id,email,created_at) VALUES (?,?,?)", [userId, email, nowIso()]);
    }
  }
  await q(`UPDATE donations SET status='paid', paid_at=?, amount_cents=?, fee_cents=?, net_cents=?, fee_is_estimate=?, email=?, user_id=?, provider_payment_id=? WHERE id=? AND status!='paid'`, [
    nowIso(), info.amount_cents, fee, info.amount_cents - fee, info.fee_is_estimate === false ? 0 : 1, email, userId, info.payment_id || null, id,
  ]);
  return { already: false, ...(await allocateAndLaunch()) };
}

export type LeaderRow = { name: string; link: string | null; total_cents: number; count: number; anonymous: boolean; example: boolean };
export async function getLeaderboard(limit = 20): Promise<LeaderRow[]> {
  const rows = await q<any>(`
    SELECT CASE WHEN d.display_mode='named' THEN COALESCE(NULLIF(u.display_name,''), d.display_name) ELSE NULL END AS name,
           CASE WHEN d.display_mode='named' AND d.link_to_account=1 THEN u.link_url ELSE NULL END AS link,
           CASE WHEN d.display_mode='named' THEN COALESCE(d.user_id, d.display_name) ELSE 'anon' END AS grp,
           SUM(d.amount_cents) AS total, COUNT(*) AS n, MAX(d.is_example) AS ex
    FROM donations d LEFT JOIN users u ON u.id=d.user_id
    WHERE d.status='paid' GROUP BY grp ORDER BY total DESC LIMIT ?`, [limit + 1]);
  const out: LeaderRow[] = rows.map((r) => ({ name: r.grp === "anon" ? `Anonymous donors (${r.n})` : r.name || "Supporter", link: r.link || null, total_cents: Number(r.total), count: Number(r.n), anonymous: r.grp === "anon", example: Number(r.ex) === 1 }));
  for (const o of getOfflineDonations()) {
    const hit = out.find((r) => !r.anonymous && r.name === o.name);
    if (hit) { hit.total_cents += Number(o.amount_cents); hit.count += 1; }
    else out.push({ name: o.name, link: null, total_cents: Number(o.amount_cents), count: 1, anonymous: false, example: false });
  }
  return out.sort((a, z) => z.total_cents - a.total_cents).slice(0, limit + 1);
}

export async function getRecentDonations(limit = 8) {
  const rows = await q<any>(`SELECT d.amount_cents, d.paid_at, d.message, d.is_example,
     CASE WHEN d.display_mode='named' THEN COALESCE(NULLIF(u.display_name,''), d.display_name) ELSE 'Anonymous' END AS name
     FROM donations d LEFT JOIN users u ON u.id=d.user_id WHERE d.status='paid' ORDER BY d.paid_at DESC LIMIT ?`, [limit]);
  const off = getOfflineDonations().map((o) => ({ amount_cents: Number(o.amount_cents), paid_at: o.paid_at, message: o.message ?? null, is_example: 0, name: o.name }));
  return [...rows, ...off].sort((a, z) => String(z.paid_at).localeCompare(String(a.paid_at))).slice(0, limit);
}

export async function getJobs() {
  return q<any>("SELECT j.*, m.title, m.key FROM jobs j JOIN milestones m ON m.id=j.milestone_id ORDER BY j.created_at DESC LIMIT 20");
}

export const usd = (cents: number, digits = 2) => `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
