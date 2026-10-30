import { devLoginAllowed, emailMode, SITE_NAME } from "./config";

/** Sends a magic link. In dev mode (no RESEND_API_KEY) the link is returned to the caller to show on screen; it is never logged. */
export async function sendMagicLink(email: string, link: string): Promise<{ sent: boolean; devLink?: string }> {
  if (emailMode() === "dev") {
    if (!devLoginAllowed()) throw new Error("no email provider configured");
    return { sent: false, devLink: link };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || `${SITE_NAME} <onboarding@resend.dev>`,
      to: [email],
      subject: `Your sign-in link for ${SITE_NAME}`,
      html: `<p>Click to sign in to ${SITE_NAME}. The link works once and expires in 20 minutes.</p><p><a href="${link}">Sign in</a></p><p>If you didn't ask for this, ignore this email.</p>`,
      text: `Sign in to ${SITE_NAME}: ${link}\n\nThe link works once and expires in 20 minutes.`,
    }),
  });
  if (!res.ok) throw new Error(`email provider returned HTTP ${res.status}`);
  return { sent: true };
}
