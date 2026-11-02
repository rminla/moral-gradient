import Link from "next/link";
import { OWNER_NAME, SITE_NAME } from "@/lib/config";
import { GradientRule, Mark } from "./Brand";

/** Direction A footer: full-bleed black, giant expanded wordmark, link cells. */
export default function Footer() {
  return (
    <footer className="mt-28 bg-ink text-white">
      <div className="mx-auto max-w-[1200px]">
        <div className="grid border-b border-white/10 md:grid-cols-[1.4fr_1fr_1fr]">
          <div className="border-b border-white/10 p-6 md:border-b-0 md:border-r md:p-8">
            <Mark size={28} light />
            <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-white/65">An independent, open project by {OWNER_NAME}, to help everyone, not only researchers, understand and talk about AI alignment and safety. We publish what models choose and do. We never publish a &ldquo;right answer&rdquo;.</p>
          </div>
          <div className="border-b border-white/10 p-6 md:border-b-0 md:border-r md:p-8">
            <div className="kicker mb-4 text-white/40">Read</div>
            <ul className="space-y-2 text-[15px]">
              <li><Link className="hover:text-vermilion" href="/try">Try a dilemma</Link></li>
              <li><Link className="hover:text-vermilion" href="/quiz">Which AI model are you most like?</Link></li>
              <li><Link className="hover:text-vermilion" href="/learn">Learn: AI alignment in plain language</Link></li>
              <li><Link className="hover:text-vermilion" href="/results">Results</Link></li>
              <li><Link className="hover:text-vermilion" href="/stated-vs-actual">Says vs does</Link></li>
              <li><Link className="hover:text-vermilion" href="/reasoning">Reasoning vs stated reasons</Link></li>
              <li><Link className="hover:text-vermilion" href="/compare">Compare models</Link></li>
              <li><Link className="hover:text-vermilion" href="/models">Weak spots per model</Link></li>
              <li><Link className="hover:text-vermilion" href="/about">Methodology</Link></li>
              <li><Link className="hover:text-vermilion" href="/costs">Live costs &amp; funding queue</Link></li>
              <li><Link className="hover:text-vermilion" href="/donate">Donate</Link></li>
              <li><Link className="hover:text-vermilion" href="/subscribe">New findings by email</Link></li>
              <li><Link className="hover:text-vermilion" href="/privacy">Privacy</Link></li>
            </ul>
          </div>
          <div className="p-6 md:p-8">
            <div className="kicker mb-4 text-white/40">Independence</div>
            <p className="text-[15px] leading-relaxed text-white/65">Donations never influence methods or results. Donations from AI labs or their employees are disclosed.</p>
          </div>
        </div>
        <div className="overflow-hidden px-5 pt-10 md:px-8">
          <div className="wide select-none whitespace-nowrap text-[8.4vw] font-extrabold uppercase leading-[0.8] tracking-[-0.04em] text-white lg:text-[100px]">Moral<span className="text-vermilion">.</span>Gradient</div>
        </div>
        <div className="px-5 pb-10 pt-8 md:px-8">
          <GradientRule left="what it says" right="what it does" dark />
          <p className="mt-6 font-mono text-[10.5px] uppercase tracking-[0.08em] text-white/40">{SITE_NAME} · Open data · Open costs · Funded by readers</p>
        </div>
      </div>
    </footer>
  );
}
