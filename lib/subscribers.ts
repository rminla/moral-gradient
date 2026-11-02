import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { devLoginAllowed, emailMode, SITE_NAME, SITE_URL } from "./config";
import { newId, nowIso, q } from "./db";
import { sendSubscribeConfirm } from "./email";

export const CONSENT_VERSION = "2026-11-02";
export const CONSENT_TEXT = `Email me new findings from ${SITE_NAME}. Only when there are new results; unsubscribe in one click. My email is never shown or shared.`;
export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const secret = () => process.env.SESSION_SECRET || "mg";
const hashToken = (t: string) => createHash("sha256").update(t + secret()).digest("hex");

/** Stateless unsubscribe signature, so every email can carry a working link without storing it. */
export const unsubSig = (id: string) => createHmac("sha256", secret()).update(`unsub:${id}`).digest("base64url").slice(0, 32);
export const unsubLink = (id: string) => `${SITE_URL}/subscribe/unsubscribe?id=${encodeURIComponent(id)}&sig=${unsubSig(id)}`;
export function validUnsub(id: string, sig: string) {
  const a = Buffer.from(unsubSig(id)), b = Buffer.from(sig || "");
  return a.length === b.length && timingSafeEqual(a, b);
}

export type SubscribeResult = { status: "sent" | "pending"; devLink?: string };

/**
 * Adds (or re-requests) a subscription as PENDING and sends the double opt-in email when the provider is configured.
 * Never reveals whether the address was already on the list. Without a working provider the row stays pending with
 * confirm_sent_at NULL, so `npm run subscribers:confirm` can send the confirmations later.
 */
export async function subscribe(emailRaw: string, source: string): Promise<SubscribeResult> {
  const email = emailRaw.trim().toLowerCase();
  const existing = (await q<any>("SELECT id, status FROM subscribers WHERE email=?", [email]))[0];
  if (existing?.status === "confirmed") return { status: emailMode() === "resend" ? "sent" : "pending" };
  const id = existing?.id || newId("sub_");
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + 7 * 86400_000).toISOString();
  if (existing) {
    await q("UPDATE subscribers SET status='pending', source=?, consent_text=?, consent_version=?, confirm_token_hash=?, confirm_expires_at=?, confirm_sent_at=NULL, unsubscribed_at=NULL WHERE id=?",
      [source, CONSENT_TEXT, CONSENT_VERSION, hashToken(token), expires, id]);
  } else {
    await q("INSERT INTO subscribers (id,email,status,source,consent_text,consent_version,created_at,confirm_token_hash,confirm_expires_at) VALUES (?,?,'pending',?,?,?,?,?,?)",
      [id, email, source, CONSENT_TEXT, CONSENT_VERSION, nowIso(), hashToken(token), expires]);
  }
  const link = `${SITE_URL}/subscribe/confirm?token=${token}`;
  if (emailMode() === "dev") return devLoginAllowed() ? { status: "pending", devLink: link } : { status: "pending" };
  try {
    await sendSubscribeConfirm(email, link, unsubLink(id));
    await q("UPDATE subscribers SET confirm_sent_at=? WHERE id=?", [nowIso(), id]);
    return { status: "sent" };
  } catch {
    return { status: "pending" };
  }
}

export async function confirm(token: string): Promise<boolean> {
  if (!token) return false;
  const r = (await q<any>("SELECT id, confirm_expires_at FROM subscribers WHERE confirm_token_hash=? AND status='pending'", [hashToken(token)]))[0];
  if (!r || new Date(r.confirm_expires_at) < new Date()) return false;
  await q("UPDATE subscribers SET status='confirmed', confirmed_at=?, confirm_token_hash=NULL WHERE id=?", [nowIso(), r.id]);
  return true;
}

export async function unsubscribe(id: string, sig: string): Promise<boolean> {
  if (!id || !validUnsub(id, sig)) return false;
  await q("UPDATE subscribers SET status='unsubscribed', unsubscribed_at=?, confirm_token_hash=NULL WHERE id=?", [nowIso(), id]);
  return true;
}
