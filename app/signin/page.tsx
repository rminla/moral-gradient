import { Eyebrow } from "@/components/Brand";
import { emailMode } from "@/lib/config";

export const metadata = { title: "Sign in" };
const ERR: Record<string, string> = { email: "That doesn't look like an email address.", expired: "That link has expired or was already used. Request a new one.", send: "We couldn't send the email. Try again in a minute." };

export default async function SignIn({ searchParams }: { searchParams: Promise<{ sent?: string; dev?: string; error?: string; next?: string }> }) {
  const sp = await searchParams;
  return (
    <main>
      <section className="relative mx-auto max-w-[1200px] overflow-hidden border-b border-rule">
      <div aria-hidden className="pixel-grid absolute inset-0 [mask-image:linear-gradient(to_bottom,black,transparent_90%)]" />
      <div className="relative mx-auto max-w-md px-5 py-16 md:py-24">
      <Eyebrow>Sign in</Eyebrow>
      <h1 className="wide mt-6 text-[44px] font-bold leading-none tracking-[-0.045em] md:text-[56px]">Sign <span className="text-vermilion">in.</span></h1>
      <p className="mt-4 text-[16px] text-ink/65">No password. We email you a one-time link. Donors get access to prompts and reasoning traces.</p>
      {sp.error && <div className="mt-4 border border-vermilion bg-highlight/40 p-3 text-sm text-vermilion-dark">{ERR[sp.error] || "Something went wrong."}</div>}
      {sp.sent ? (
        <div className="ticks mt-8 border border-rule bg-paper p-6 text-sm">
          <div className="text-[18px] font-semibold">Check your email.</div>
          <p className="mt-1 text-ink/60">The link works once and expires in 20 minutes.</p>
          {sp.dev && emailMode() === "dev" && (
            <div className="mt-4 border border-rule bg-panel p-3 font-mono text-[11px] leading-5 text-ink">
              <b>Dev mode</b> (no email provider configured): <a className="break-all font-semibold underline" href={sp.dev}>open your sign-in link</a>
            </div>
          )}
        </div>
      ) : (
        <form action="/api/auth/request" method="post" className="ticks mt-8 space-y-5 border border-rule bg-paper p-6">
          <input type="hidden" name="next" value={sp.next || "/account"} />
          <div><span className="label">Email</span><input name="email" type="email" required className="input" placeholder="you@example.com" /></div>
          <button className="btn-primary w-full">Email me a sign-in link</button>
        </form>
      )}
      </div>
      </section>
    </main>
  );
}
