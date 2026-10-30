import Link from "next/link";
import { OWNER_NAME, SITE_NAME } from "@/lib/config";
import { GradientRule, Wordmark } from "./Brand";

export default function Footer() {
  return (
    <footer className="mt-28 border-t border-ink">
      <div className="mx-auto max-w-6xl px-5 pb-12 pt-10">
        <div className="grid gap-8 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <Wordmark size="text-[26px]" />
            <p className="mt-4 max-w-sm font-serif text-[16px] leading-relaxed text-ink/75">An independent, open project by {OWNER_NAME}. Descriptive only: we publish what models choose, never a &ldquo;right answer&rdquo;.</p>
          </div>
          <div>
            <div className="label">Read</div>
            <ul className="space-y-1.5 font-sans text-sm">
              <li><Link className="link" href="/results">Results</Link></li>
              <li><Link className="link" href="/about">Methodology &amp; hold-out policy</Link></li>
              <li><Link className="link" href="/costs">Live costs &amp; funding queue</Link></li>
            </ul>
          </div>
          <div>
            <div className="label">Independence</div>
            <p className="font-sans text-sm leading-6 text-ink/70">Donations never influence methods or results. Donations from AI labs or their employees are disclosed.</p>
          </div>
        </div>
        <GradientRule className="mt-10" left="what it says" right="what it does" />
        <p className="mt-4 font-sans text-[11px] text-ink/45">{SITE_NAME} · Open data · Open costs · Funded by readers</p>
      </div>
    </footer>
  );
}
