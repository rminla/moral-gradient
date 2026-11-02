import Link from "next/link";
import { Eyebrow } from "@/components/Brand";
import Subscribe, { SUB_MESSAGES } from "@/components/Subscribe";

export const metadata = { title: "New findings by email" };

const PAGE_MESSAGES: Record<string, { title: string; body: string }> = {
  ...SUB_MESSAGES,
  confirmed: { title: "You're on the list.", body: "We'll email you when there are new findings. Every email has a one-click unsubscribe link." },
  expired: { title: "That link has expired or was already used.", body: "Sign up again below and we'll send a new one." },
  unsubscribed: { title: "You're unsubscribed.", body: "You won't get any more emails from us. Sorry to see you go." },
  badlink: { title: "That unsubscribe link didn't work.", body: "Use the full link from your latest email and try again." },
};

export default async function SubscribePage({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const { s } = await searchParams;
  const m = s ? PAGE_MESSAGES[s] : null;
  return (
    <main>
      <section className="relative mx-auto max-w-[1200px] overflow-hidden border-b border-rule">
        <div aria-hidden className="pixel-grid absolute inset-0 [mask-image:linear-gradient(to_bottom,black,transparent_90%)]" />
        <div className="relative mx-auto max-w-xl px-5 py-16 md:py-24">
          <Eyebrow>New findings by email</Eyebrow>
          <h1 className="wide mt-6 text-[40px] font-bold leading-none tracking-[-0.045em] md:text-[56px]">{m ? m.title : <>Stay in the <span className="text-vermilion">loop.</span></>}</h1>
          {m && <p className="mt-4 text-[16px] text-ink/65" role="status">{m.body}</p>}
          {s !== "confirmed" && s !== "unsubscribed" && s !== "sent" && s !== "pending" && <div className="ticks mt-8 border border-rule bg-paper p-6"><Subscribe source="subscribe" /></div>}
          <p className="mt-8 text-[14px] text-ink/55"><Link className="link" href="/try">Try a dilemma</Link> · <Link className="link" href="/learn">Learn the basics</Link> · <Link className="link" href="/privacy">Privacy</Link></p>
        </div>
      </section>
    </main>
  );
}
