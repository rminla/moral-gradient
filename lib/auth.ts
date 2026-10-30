import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { newId, nowIso, q } from "./db";

const COOKIE = "oi_session";
const hash = (s: string) => createHash("sha256").update(s + (process.env.SESSION_SECRET || "")).digest("hex");

export type User = { id: string; email: string; display_name: string | null; link_url: string | null };

export async function createMagicToken(email: string, nextPath = "/account") {
  const token = randomBytes(32).toString("base64url");
  await q("INSERT INTO magic_tokens (token_hash,email,expires_at,next_path) VALUES (?,?,?,?)", [
    hash(token), email.toLowerCase(), new Date(Date.now() + 20 * 60_000).toISOString(), nextPath.startsWith("/") ? nextPath : "/account",
  ]);
  return token;
}

export async function consumeMagicToken(token: string): Promise<{ userId: string; next: string } | null> {
  const rows = await q<any>("SELECT * FROM magic_tokens WHERE token_hash=?", [hash(token)]);
  const t = rows[0];
  if (!t || t.used_at || new Date(t.expires_at) < new Date()) return null;
  await q("UPDATE magic_tokens SET used_at=? WHERE token_hash=?", [nowIso(), t.token_hash]);
  let u = (await q<any>("SELECT id FROM users WHERE email=?", [t.email]))[0];
  if (!u) {
    u = { id: newId("usr_") };
    await q("INSERT INTO users (id,email,created_at) VALUES (?,?,?)", [u.id, t.email, nowIso()]);
  }
  return { userId: u.id, next: t.next_path || "/account" };
}

export async function startSession(userId: string) {
  const sid = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + 30 * 86400_000);
  await q("INSERT INTO sessions (id_hash,user_id,expires_at) VALUES (?,?,?)", [hash(sid), userId, expires.toISOString()]);
  (await cookies()).set(COOKIE, sid, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", expires });
}

export async function endSession() {
  const jar = await cookies();
  const sid = jar.get(COOKIE)?.value;
  if (sid) await q("DELETE FROM sessions WHERE id_hash=?", [hash(sid)]);
  jar.delete(COOKIE);
}

export async function currentUser(): Promise<User | null> {
  const sid = (await cookies()).get(COOKIE)?.value;
  if (!sid) return null;
  const rows = await q<any>("SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id_hash=? AND s.expires_at>?", [hash(sid), nowIso()]);
  return rows[0] ? { id: rows[0].id, email: rows[0].email, display_name: rows[0].display_name, link_url: rows[0].link_url } : null;
}

/** Donor = at least one paid donation linked to this account (by user id or email). */
export async function isDonor(u: User | null): Promise<boolean> {
  if (!u) return false;
  const r = await q<any>("SELECT 1 FROM donations WHERE status='paid' AND (user_id=? OR email=?) LIMIT 1", [u.id, u.email]);
  return r.length > 0;
}

export const isAdmin = (u: User | null) =>
  !!u && (process.env.ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean).includes(u.email.toLowerCase());
