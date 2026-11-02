"use client";
import Link from "next/link";
import { useState } from "react";

export const SUB_MESSAGES: Record<string, { title: string; body: string }> = {
  sent: { title: "Check your inbox.", body: "If this address isn't on the list yet, we've sent a confirmation link. You're only added after you click it." },
  pending: { title: "Thanks, we'll confirm soon.", body: "Your address is saved as unconfirmed. We'll email you a confirmation link shortly, and you're only added after you click it." },
  invalid: { title: "That doesn't look like an email address.", body: "Please check it and try again." },
  consent: { title: "Please tick the box.", body: "We only add people who ask to be added." },
  limited: { title: "Too many requests.", body: "Please wait a while and try again." },
  error: { title: "Something went wrong.", body: "Please try again in a minute." },
};

/** "Send me new findings" signup. Double opt-in; works without JavaScript (falls back to a normal form post). */
export default function Subscribe({ source, dark = false, compact = false }: { source: string; dark?: boolean; compact?: boolean }) {
  const [state, setState] = useState<{ status: string; devLink?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const muted = dark ? "text-white/60" : "text-ink/60";
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/subscribe", { method: "POST", body: new FormData(e.currentTarget), headers: { accept: "application/json" } });
      const j = await res.json().catch(() => ({ status: "error" }));
      setState({ status: j.status || "error", devLink: j.devLink });
    } catch {
      setState({ status: "error" });
    } finally {
      setBusy(false);
    }
  }
  const msg = state && (SUB_MESSAGES[state.status] || SUB_MESSAGES.error);
  const done = state && (state.status === "sent" || state.status === "pending");
  return (
    <div id="updates" className={dark ? "text-white" : ""}>
      {!compact && <div className={`kicker ${dark ? "text-vermilion" : "text-ink"}`}>Get new findings</div>}
      {!compact && <p className={`mt-3 max-w-md text-[15px] leading-relaxed ${muted}`}>An email when there are new results, written for everyone. Nothing else.</p>}
      {done ? (
        <div className={`mt-4 border p-4 text-[14px] ${dark ? "border-white/20" : "border-rule bg-panel"}`} role="status">
          <div className="font-semibold">{msg!.title}</div>
          <p className={`mt-1 ${muted}`}>{msg!.body}</p>
          {state!.devLink && <p className="mt-2 font-mono text-[11px]"><b>Dev mode:</b> <a className="underline" href={state!.devLink}>open the confirmation link</a></p>}
        </div>
      ) : (
        <form action="/api/subscribe" method="post" onSubmit={onSubmit} className="mt-4">
          <input type="hidden" name="source" value={source} />
          <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden"><label>Leave this empty<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="sr-only" htmlFor={`sub-${source}`}>Email</label>
            <input id={`sub-${source}`} name="email" type="email" required maxLength={200} placeholder="you@example.com" className={`input sm:flex-1 ${dark ? "!border-white/25 !bg-transparent !text-white placeholder:!text-white/40 focus:!border-white" : ""}`} />
            <button disabled={busy} className={dark ? "btn border-white bg-white text-ink hover:bg-vermilion hover:border-vermilion hover:text-white" : "btn-primary"}>{busy ? "Sending…" : "Send me new findings"}</button>
          </div>
          <label className={`mt-3 flex items-start gap-2 text-[13px] leading-5 ${muted}`}>
            <input type="checkbox" name="consent" required className="mt-0.5 accent-ink" />
            <span>Yes, email me new findings. We&apos;ll send a link to confirm first. Unsubscribe in one click. <Link href="/privacy" className="underline">Privacy</Link></span>
          </label>
          {msg && <p className="mt-2 text-[13px] text-vermilion" role="alert">{msg.title} {msg.body}</p>}
        </form>
      )}
    </div>
  );
}
