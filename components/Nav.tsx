import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { Wordmark } from "./Brand";

const LINKS = [
  ["/try", "Try it"],
  ["/thinks-vs-does", "Thinks vs does"],
  ["/drift", "Agent drift"],
  ["/learn", "Learn"],
  ["/results", "Results"],
  ["/compare", "Compare"],
  ["/models", "Models"],
  ["/costs", "Funding"],
  ["/about", "Method"],
] as const;

/** Direction A nav: a row of bordered cells inside the page frame, ending in a black Donate cell. */
export default async function Nav() {
  const u = await currentUser();
  return (
    <>
      {/* page frame: two hairlines that run the full height of every page */}
      <div aria-hidden className="pointer-events-none absolute inset-y-0 left-1/2 z-50 hidden w-full max-w-[1200px] -translate-x-1/2 border-x border-[rgb(128_128_128/0.28)] lg:block" />
      <header className="sticky top-0 z-40 border-b border-rule bg-paper">
        <div className="mx-auto flex h-16 max-w-[1200px] items-stretch">
          <Link href="/" aria-label="Moral Gradient, home" className="flex shrink-0 items-center border-r border-rule px-4 2xl:px-5"><Wordmark /></Link>
          <nav className="hidden items-stretch md:flex">
            {LINKS.map(([h, t]) => (
              <Link key={h} href={h} className={`items-center whitespace-nowrap border-r border-rule px-2.5 font-mono text-[11.5px] uppercase tracking-[0.06em] transition-colors hover:bg-panel hover:text-ink xl:text-[12px] xl:tracking-[0.08em] 2xl:px-5 ${["/compare", "/costs"].includes(h) ? "hidden xl:flex" : "flex"} ${h === "/try" ? "gap-2 text-ink" : h === "/thinks-vs-does" ? "gap-2 text-vermilion" : "text-ink/70"}`}>{h === "/try" && <span className="h-2 w-2 bg-vermilion" />}{h === "/thinks-vs-does" && <span className="h-2 w-2 border border-vermilion" />}{t}</Link>
            ))}
          </nav>
          <div className="hatch hidden flex-1 md:block" />
          <div className="flex-1 md:hidden" />
          <Link href={u ? "/account" : "/signin"} className="hidden items-center whitespace-nowrap border-l border-rule px-4 font-mono text-[12px] uppercase tracking-[0.08em] text-ink/70 hover:text-ink sm:flex 2xl:px-5 xl:flex">
            {u ? (u.display_name || u.email.split("@")[0]) : "Sign in"}
          </Link>
          <Link href="/donate" className="flex items-center gap-2.5 bg-ink px-4 font-mono text-[12px] font-medium uppercase tracking-[0.08em] text-white transition-colors hover:bg-vermilion 2xl:px-5">
            <span className="blink h-2 w-2 bg-vermilion" />Donate
          </Link>
        </div>
        <nav className="grid grid-cols-3 border-t border-rule md:hidden">
          {LINKS.filter(([h]) => !["/compare", "/models", "/costs", "/about", "/drift"].includes(h)).map(([h, t], i) => (
            <Link key={h} href={h} className={`whitespace-nowrap py-2.5 text-center font-mono text-[10px] sm:text-[11px] uppercase tracking-[0.08em] ${h === "/try" ? "bg-vermilion text-white" : "text-ink/70"} ${i < 2 ? "border-r border-rule" : ""}`}>{t}</Link>
          ))}
        </nav>
      </header>
    </>
  );
}
