// Initialise the site DB: schema + milestone queue. Flags:
//   --reseed-milestones   re-read data/milestones.json (only replaces queued, unfunded milestones)
//   --examples            add clearly-flagged EXAMPLE donations (is_example=1) for local previews. Never use in production.
import { createClient } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";

for (const f of [".env.local", ".env"]) if (fs.existsSync(f)) for (const line of fs.readFileSync(f, "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}
const url = process.env.DATABASE_URL || "file:./data/site.db";
if (url.startsWith("file:")) fs.mkdirSync(path.dirname(path.resolve(url.slice(5))), { recursive: true });
const c = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN || undefined });
// Schema lives in lib/db.ts; the app creates it lazily. Hit it here via a tiny import-free copy:
const schema = fs.readFileSync("lib/db.ts", "utf8").match(/const SCHEMA = \[([\s\S]*?)\n\];/)[1].match(/`[\s\S]*?`/g).map((s) => s.slice(1, -1));
for (const s of schema) await c.execute(s);
const args = process.argv.slice(2);
const { milestones } = JSON.parse(fs.readFileSync("data/milestones.json", "utf8"));
if (args.includes("--reseed-milestones")) await c.execute("DELETE FROM milestones WHERE status='queued' AND funded_cents=0");
const have = new Set((await c.execute("SELECT key FROM milestones")).rows.map((r) => r.key));
let pos = Number((await c.execute("SELECT COALESCE(MAX(position),0) p FROM milestones")).rows[0].p);
for (const m of milestones) if (!have.has(m.key)) await c.execute({ sql: "INSERT INTO milestones (key,position,kind,title,lab,model_id,provider,suite,cost_cents) VALUES (?,?,?,?,?,?,?,?,?)", args: [m.key, ++pos, m.kind, m.title, m.lab, m.model_id, m.provider, m.suite, Math.round(m.cost_usd * 100)] });
if (args.includes("--examples")) {
  const ex = [["Ada L. (example)", 2500, "named"], [null, 500, "anonymous"], ["Moral Machine fan (example)", 1000, "named"], [null, 300, "anonymous"]];
  let i = 0;
  for (const [name, cents, mode] of ex) {
    const fee = Math.round(cents * 0.029 + 30), t = new Date(Date.now() - (ex.length - i++) * 3600e3).toISOString();
    await c.execute({ sql: "INSERT OR IGNORE INTO donations (id,created_at,paid_at,status,amount_cents,fee_cents,net_cents,display_mode,display_name,provider,is_example,message) VALUES (?,?,?,'paid',?,?,?,?,?,'example',1,?)",
      args: [`don_example_${i}`, t, t, cents, fee, cents - fee, mode, name, i === 1 ? "Excited to see the borderline results." : null] });
  }
  console.log("added example donations (is_example=1). Note: run the app's allocation by making any donation, or POST a mock donation.");
}
console.log("db ready:", url.replace(/\?.*$/, ""), "milestones:", (await c.execute("SELECT COUNT(*) n FROM milestones")).rows[0].n);
