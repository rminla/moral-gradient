import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { SITE_NAME } from "@/lib/config";

export default async function Nav() {
  const u = await currentUser();
  return (
    <header className="sticky top-0 z-40 border-b border-black/10 bg-paper/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-5">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-ink text-[13px] text-white serif">{SITE_NAME.charAt(0)}</span>
          <span className="serif text-lg">{SITE_NAME}</span>
        </Link>
        <nav className="hidden items-center gap-5 text-sm text-black/70 md:flex">
          <Link href="/results" className="hover:text-black">Results</Link>
          <Link href="/costs" className="hover:text-black">Costs &amp; funding</Link>
          <Link href="/about" className="hover:text-black">Methodology</Link>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {u ? (
            <Link href="/account" className="btn-ghost !py-1.5">{u.display_name || u.email.split("@")[0]}</Link>
          ) : (
            <Link href="/signin" className="text-sm text-black/70 hover:text-black">Sign in</Link>
          )}
          <Link href="/donate" className="btn-money !py-1.5">Donate</Link>
        </div>
      </div>
    </header>
  );
}
