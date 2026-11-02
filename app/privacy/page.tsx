import Link from "next/link";
import { PageHead } from "@/components/Brand";
import { OWNER_NAME, SITE_NAME } from "@/lib/config";

export const metadata = { title: "Privacy", description: `What ${SITE_NAME} stores about you, and why.` };

const ROWS: [string, string][] = [
  ["Try it", "Your answers to the dilemmas stay in your browser. They are never sent to us or stored."],
  ["New findings by email", "If you sign up, we store your email address, where you signed up, the exact consent text you agreed to, and when you confirmed. You are only added after you click the confirmation link. Every email has a one-click unsubscribe link. We never sell or share the list, and we only email it about new findings."],
  ["Donations", "Stripe handles card details; we never see them. We store the amount, how you chose to be shown (anonymous or a display name), an optional message, and the email you gave for your receipt and donor access. A donation does not add you to the findings list unless you tick that box."],
  ["Sign in", "We store your email and a hashed one-time token to send you a sign-in link, and a hashed session id in a cookie while you are signed in. That cookie is the only one we set."],
  ["Abuse protection", "To stop spam on the sign-up and sign-in forms, we keep a salted hash of your IP address and email for up to 24 hours."],
  ["Who processes it", "The site is hosted on Vercel, and its database with a hosted database provider. Email is sent through Resend, and payments go through Stripe. We use no ads and no third-party analytics."],
];

export default function Privacy() {
  return (
    <main>
      <PageHead eyebrow="Privacy" grey="What we" title={<>store<span className="text-vermilion">.</span></>}>{SITE_NAME} is an independent project by {OWNER_NAME}. We collect as little as we can. This page covers everything the site stores.</PageHead>
      <section className="mx-auto max-w-[1200px] border-b border-rule">
        {ROWS.map(([t, d]) => (
          <div key={t} className="grid gap-2 border-b border-rule p-5 last:border-0 md:grid-cols-[260px_minmax(0,1fr)] md:gap-8 md:p-8">
            <div className="kicker text-ink">{t}</div>
            <p className="max-w-3xl text-[16px] leading-relaxed text-ink/70">{d}</p>
          </div>
        ))}
      </section>
      <p className="mx-auto max-w-[1200px] px-5 pt-6 text-[14px] text-ink/55 md:px-8">To unsubscribe, use the link at the bottom of any email from us. <Link className="link" href="/subscribe">Sign up for new findings</Link>. Updated November 2, 2026.</p>
    </main>
  );
}
