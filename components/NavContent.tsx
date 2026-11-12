"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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

type NavContentProps = {
  userLink: { href: string; label: string };
};

export function NavContent({ userLink }: NavContentProps) {
  const pathname = usePathname();

  return (
    <>
      <nav className="hidden items-stretch md:flex">
        <Link
          href="/try"
          className={`flex items-center gap-2 whitespace-nowrap border-r border-rule px-3 font-mono text-[11.5px] uppercase tracking-[0.06em] transition-colors hover:bg-panel hover:text-ink xl:px-4 xl:text-[12px] xl:tracking-[0.08em] ${
            pathname === "/try" ? "text-ink" : "text-ink/70"
          }`}
        >
          {pathname === "/try" && <span className="h-2 w-2 bg-vermilion" />}
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
    </>
  );
}
