import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { Wordmark } from "./Brand";

export default async function Nav() {
  const u = await currentUser();
  return (
    <header className="sticky top-0 z-40 border-b border-ink bg-paper/95 backdrop-blur-[2px]">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-7 px-5">
        <Link href="/" aria-label="Moral Gradient, home" className="shrink-0"><Wordmark /></Link>
        <nav className="hidden items-center gap-6 font-sans text-[13px] text-ink/75 md:flex">
          <Link href="/results" className="hover:text-vermilion">Results</Link>
          <Link href="/costs" className="hover:text-vermilion">Costs &amp; funding</Link>
          <Link href="/about" className="hover:text-vermilion">Methodology</Link>
        </nav>
        <div className="ml-auto flex items-center gap-4">
          {u ? (
            <Link href="/account" className="font-sans text-[13px] text-ink/75 hover:text-vermilion">{u.display_name || u.email.split("@")[0]}</Link>
          ) : (
            <Link href="/signin" className="font-sans text-[13px] text-ink/75 hover:text-vermilion">Sign in</Link>
          )}
          <Link href="/donate" className="btn-money !px-3.5 !py-1.5 !text-[13px]">Donate</Link>
        </div>
      </div>
      <nav className="flex gap-5 overflow-x-auto border-t border-ink/10 px-5 py-2 font-sans text-[13px] text-ink/75 md:hidden">
        <Link href="/results">Results</Link><Link href="/costs">Costs &amp; funding</Link><Link href="/about">Methodology</Link>
      </nav>
    </header>
  );
}
