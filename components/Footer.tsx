import Link from "next/link";
import { OWNER_NAME, SITE_NAME } from "@/lib/config";

export default function Footer() {
  return (
    <footer className="mt-24 border-t border-black/10">
      <div className="mx-auto grid max-w-6xl gap-6 px-5 py-10 text-sm text-black/60 md:grid-cols-3">
        <div>
          <div className="serif text-base text-black">{SITE_NAME}</div>
          <p className="mt-2">An independent, open project by {OWNER_NAME}. Descriptive only: we publish what models choose, never a &ldquo;right answer&rdquo;.</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Link href="/results">Results</Link>
          <Link href="/costs">Live costs &amp; funding queue</Link>
          <Link href="/about">Methodology &amp; hold-out policy</Link>
        </div>
        <div>
          <p>Donations never influence methods or results. Donations from AI labs or their employees are disclosed.</p>
        </div>
      </div>
    </footer>
  );
}
