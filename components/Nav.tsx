import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { Wordmark } from "./Brand";
import { NavDropdown } from "./NavDropdown";
import { NavMobile } from "./NavMobile";

const RESULTS_ITEMS = [
  { href: "/thinks-vs-does", label: "Thinks vs Does" },
  { href: "/drift", label: "Agent Drift" },
  { href: "/compare", label: "Compare models" },
  { href: "/models", label: "All models" },
];

const ABOUT_ITEMS = [
  { href: "/learn", label: "Learn the basics" },
  { href: "/about", label: "Methodology" },
  { href: "/costs", label: "Funding and costs" },
];

const MOBILE_SECTIONS = [
  {
    title: "Try",
    items: [{ href: "/try", label: "Try it" }],
  },
  {
    title: "Results",
    items: [
      { href: "/results", label: "Overview" },
      ...RESULTS_ITEMS,
    ],
  },
  {
    title: "About",
    items: ABOUT_ITEMS,
  },
];

/** Direction A nav: a row of bordered cells inside the page frame, ending in a black Donate cell. */
export default async function Nav() {
  const u = await currentUser();
  const userLink = {
    href: u ? "/account" : "/signin",
    label: u ? (u.display_name || u.email.split("@")[0]) : "Sign in",
  };

  return (
    <>
      {/* page frame: two hairlines that run the full height of every page */}
      <div aria-hidden className="pointer-events-none absolute inset-y-0 left-1/2 z-50 hidden w-full max-w-[1200px] -translate-x-1/2 border-x border-[rgb(128_128_128/0.28)] lg:block" />
      <header className="sticky top-0 z-40 border-b border-rule bg-paper">
        <div className="mx-auto flex h-16 max-w-[1200px] items-stretch">
          <Link href="/" aria-label="Moral Gradient, home" className="flex shrink-0 items-center border-r border-rule px-4 2xl:px-5">
            <Wordmark />
          </Link>
          <nav className="hidden items-stretch md:flex">
            <Link
              href="/try"
              className="flex items-center gap-2 whitespace-nowrap border-r border-rule px-3 font-mono text-[11.5px] uppercase tracking-[0.06em] text-ink transition-colors hover:bg-panel xl:px-4 xl:text-[12px] xl:tracking-[0.08em]"
            >
              <span className="h-2 w-2 bg-vermilion" />
              Try it
            </Link>
            <NavDropdown label="Results" href="/results" items={RESULTS_ITEMS} />
            <NavDropdown label="About" items={ABOUT_ITEMS} />
          </nav>
          <div className="hatch hidden flex-1 md:block" />
          <div className="flex-1 md:hidden" />
          <Link
            href={userLink.href}
            className="hidden items-center whitespace-nowrap border-l border-rule px-4 font-mono text-[11.5px] uppercase tracking-[0.06em] text-ink/70 transition-colors hover:text-ink md:flex xl:text-[12px] xl:tracking-[0.08em] 2xl:px-5"
          >
            {userLink.label}
          </Link>
          <Link
            href="/donate"
            className="hidden items-center gap-2.5 bg-ink px-4 font-mono text-[12px] font-medium uppercase tracking-[0.08em] text-white transition-colors hover:bg-vermilion md:flex 2xl:px-5"
          >
            <span className="blink h-2 w-2 bg-vermilion" />
            Donate
          </Link>
          <NavMobile sections={MOBILE_SECTIONS} userLink={userLink} />
        </div>
      </header>
    </>
  );
}
