import { devLoginAllowed, emailMode, SITE_NAME } from "./config";

const FROM = () => process.env.EMAIL_FROM || `${SITE_NAME} <onboarding@resend.dev>`;

async function resend(payload: Record<string, unknown>) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ from: FROM(), ...payload }),
  });
  if (!res.ok) throw new Error(`email provider returned HTTP ${res.status}`);
}

/** Sends a magic link. In dev mode (no RESEND_API_KEY) the link is returned to the caller to show on screen; it is never logged. */
export async function sendMagicLink(email: string, link: string): Promise<{ sent: boolean; devLink?: string }> {
  if (emailMode() === "dev") {
    if (!devLoginAllowed()) throw new Error("no email provider configured");
    return { sent: false, devLink: link };
  }
  await resend({
    to: [email],
    subject: `Your sign-in link for ${SITE_NAME}`,
    html: `<p>Click to sign in to ${SITE_NAME}. The link works once and expires in 20 minutes.</p><p><a href="${link}">Sign in</a></p><p>If you didn't ask for this, ignore this email.</p>`,
    text: `Sign in to ${SITE_NAME}: ${link}\n\nThe link works once and expires in 20 minutes.`,
  });
  return { sent: true };
}

/** Double opt-in confirmation for the "new findings" list. Same provider and sender as the magic link. */
export async function sendSubscribeConfirm(email: string, confirmLink: string, unsubLink: string): Promise<void> {
  await resend({
    to: [email],
    subject: `Confirm: new findings from ${SITE_NAME}`,
    headers: { "List-Unsubscribe": `<${unsubLink}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
    html: `<p>Someone (hopefully you) asked to get new findings from ${SITE_NAME} by email.</p><p><a href="${confirmLink}">Yes, add me to the list</a></p><p>We only write when there are new results. Every email has a one-click unsubscribe link. If you didn't ask for this, ignore this email and you won't hear from us.</p>`,
    text: `Someone (hopefully you) asked to get new findings from ${SITE_NAME} by email.\n\nConfirm: ${confirmLink}\n\nIf you didn't ask for this, ignore this email and you won't hear from us.`,
  });
}
