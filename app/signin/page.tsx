import { emailMode } from "@/lib/config";

export const metadata = { title: "Sign in" };
const ERR: Record<string, string> = { email: "That doesn't look like an email address.", expired: "That link has expired or was already used. Request a new one.", send: "We couldn't send the email. Try again in a minute." };

export default async function SignIn({ searchParams }: { searchParams: Promise<{ sent?: string; dev?: string; error?: string; next?: string }> }) {
  const sp = await searchParams;
  return (
    <main className="mx-auto max-w-md px-5 py-16">
      <h1 className="serif text-4xl">Sign in</h1>
      <p className="mt-2 text-black/60">No password. We email you a one-time link. Donors get access to prompts and reasoning traces.</p>
      {sp.error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{ERR[sp.error] || "Something went wrong."}</div>}
      {sp.sent ? (
        <div className="card mt-6 p-5 text-sm">
          <div className="font-semibold">Check your email.</div>
          <p className="mt-1 text-black/60">The link works once and expires in 20 minutes.</p>
          {sp.dev && emailMode() === "dev" && (
            <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
              <b>Dev mode</b> (no email provider configured): <a className="break-all font-semibold underline" href={sp.dev}>open your sign-in link</a>
            </div>
          )}
        </div>
      ) : (
        <form action="/api/auth/request" method="post" className="card mt-6 space-y-4 p-6">
          <input type="hidden" name="next" value={sp.next || "/account"} />
          <div><span className="label">Email</span><input name="email" type="email" required className="input" placeholder="you@example.com" /></div>
          <button className="btn-primary w-full">Email me a sign-in link</button>
        </form>
      )}
    </main>
  );
}
