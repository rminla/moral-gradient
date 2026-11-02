import { createClient, type Client, type InValue } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";

let client: Client | null = null;
let ready: Promise<void> | null = null;

function getClient(): Client {
  if (!client) {
    const url = process.env.DATABASE_URL || "file:./data/site.db";
    client = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN || undefined });
  }
  return client;
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, display_name TEXT, link_url TEXT, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS magic_tokens (token_hash TEXT PRIMARY KEY, email TEXT NOT NULL, expires_at TEXT NOT NULL, used_at TEXT, next_path TEXT)`,
  `CREATE TABLE IF NOT EXISTS sessions (id_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS donations (
     id TEXT PRIMARY KEY, created_at TEXT NOT NULL, paid_at TEXT, status TEXT NOT NULL DEFAULT 'pending',
     amount_cents INTEGER NOT NULL, fee_cents INTEGER NOT NULL DEFAULT 0, net_cents INTEGER NOT NULL DEFAULT 0, fee_is_estimate INTEGER NOT NULL DEFAULT 1,
     currency TEXT NOT NULL DEFAULT 'usd', display_mode TEXT NOT NULL DEFAULT 'anonymous', display_name TEXT, message TEXT,
     email TEXT, user_id TEXT, link_to_account INTEGER NOT NULL DEFAULT 0,
     provider TEXT NOT NULL, provider_session_id TEXT UNIQUE, provider_payment_id TEXT, is_example INTEGER NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS milestones (
     id INTEGER PRIMARY KEY AUTOINCREMENT, key TEXT UNIQUE NOT NULL, position INTEGER NOT NULL, kind TEXT NOT NULL,
     title TEXT NOT NULL, lab TEXT, model_id TEXT, provider TEXT, suite TEXT NOT NULL,
     cost_cents INTEGER NOT NULL, funded_cents INTEGER NOT NULL DEFAULT 0,
     status TEXT NOT NULL DEFAULT 'queued', funded_at TEXT, job_id TEXT)`,
  `CREATE TABLE IF NOT EXISTS jobs (
     id TEXT PRIMARY KEY, milestone_id INTEGER NOT NULL, created_at TEXT NOT NULL, cap_usd REAL NOT NULL,
     mode TEXT NOT NULL, status TEXT NOT NULL, detail TEXT, finished_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, created_at TEXT NOT NULL)`, // webhook idempotency
  // "New findings" list. Double opt-in: a row is only mailable when status='confirmed'. Additive, safe on an existing DB.
  `CREATE TABLE IF NOT EXISTS subscribers (
     id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, status TEXT NOT NULL DEFAULT 'pending', source TEXT,
     consent_text TEXT NOT NULL, consent_version TEXT NOT NULL, created_at TEXT NOT NULL,
     confirm_token_hash TEXT, confirm_expires_at TEXT, confirm_sent_at TEXT, confirmed_at TEXT, unsubscribed_at TEXT)`,
  `CREATE INDEX IF NOT EXISTS subscribers_confirm ON subscribers (confirm_token_hash)`,
  // Rate limiting for public form endpoints. Keys are salted hashes (IP or email), rows older than a day are pruned.
  `CREATE TABLE IF NOT EXISTS rate_hits (bucket TEXT NOT NULL, at INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS rate_hits_bucket ON rate_hits (bucket, at)`,
];

export async function seedMilestones(reseed = false) {
  const c = getClient();
  const file = path.join(process.cwd(), "data", "milestones.json");
  if (!fs.existsSync(file)) return;
  const { milestones } = JSON.parse(fs.readFileSync(file, "utf8"));
  if (reseed) await c.execute(`DELETE FROM milestones WHERE status='queued' AND funded_cents=0`);
  const existing = new Set((await c.execute("SELECT key FROM milestones")).rows.map((r) => String(r.key)));
  let pos = Number((await c.execute("SELECT COALESCE(MAX(position),0) AS p FROM milestones")).rows[0].p);
  for (const m of milestones) {
    if (existing.has(m.key)) continue;
    pos += 1;
    await c.execute({
      sql: `INSERT INTO milestones (key, position, kind, title, lab, model_id, provider, suite, cost_cents) VALUES (?,?,?,?,?,?,?,?,?)`,
      args: [m.key, pos, m.kind, m.title, m.lab, m.model_id, m.provider, m.suite, Math.round(m.cost_usd * 100)],
    });
  }
}

export async function db(): Promise<Client> {
  const c = getClient();
  if (!ready) {
    ready = (async () => {
      const url = process.env.DATABASE_URL || "file:./data/site.db";
      if (url.startsWith("file:")) fs.mkdirSync(path.dirname(path.resolve(url.slice(5))), { recursive: true });
      for (const s of SCHEMA) await c.execute(s);
      const n = Number((await c.execute("SELECT COUNT(*) AS n FROM milestones")).rows[0].n);
      if (n === 0) await seedMilestones();
    })();
  }
  await ready;
  return c;
}

export async function q<T = Record<string, any>>(sql: string, args: InValue[] = []): Promise<T[]> {
  const c = await db();
  const r = await c.execute({ sql, args });
  return r.rows.map((row) => ({ ...row }) as T);
}

export async function kvGet<T>(key: string): Promise<T | null> {
  const rows = await q<{ value: string }>("SELECT value FROM kv WHERE key=?", [key]);
  return rows[0] ? (JSON.parse(rows[0].value) as T) : null;
}
export async function kvSet(key: string, value: unknown) {
  await q("INSERT INTO kv (key,value,updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at", [
    key, JSON.stringify(value), new Date().toISOString(),
  ]);
}

export const nowIso = () => new Date().toISOString();
export const newId = (p = "") => p + crypto.randomUUID().replace(/-/g, "").slice(0, 20);
