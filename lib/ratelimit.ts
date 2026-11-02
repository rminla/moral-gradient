import { createHash } from "node:crypto";
import { q } from "./db";

const salt = () => process.env.SESSION_SECRET || "mg";
export const hashKey = (s: string) => createHash("sha256").update(`${salt()}:${s}`).digest("hex").slice(0, 32);

/** Best client IP on Vercel (first x-forwarded-for hop), falling back to x-real-ip. */
export function clientIp(req: Request) {
  return (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
}

/** Sliding-window limiter backed by the site DB (works across serverless instances). Returns true if allowed. */
export async function allow(bucket: string, limit: number, windowSec: number): Promise<boolean> {
  const now = Date.now();
  if (Math.random() < 0.05) await q("DELETE FROM rate_hits WHERE at < ?", [now - 86_400_000]);
  const n = Number((await q<{ n: number }>("SELECT COUNT(*) AS n FROM rate_hits WHERE bucket=? AND at>?", [bucket, now - windowSec * 1000]))[0]?.n ?? 0);
  if (n >= limit) return false;
  await q("INSERT INTO rate_hits (bucket, at) VALUES (?,?)", [bucket, now]);
  return true;
}

/** Applies an IP limit and an email limit for one action. */
export async function allowRequest(req: Request, action: string, email: string, ip: [number, number], perEmail: [number, number]) {
  const okIp = await allow(`${action}:ip:${hashKey(clientIp(req))}`, ip[0], ip[1]);
  if (!okIp) return false;
  return allow(`${action}:em:${hashKey(email)}`, perEmail[0], perEmail[1]);
}
