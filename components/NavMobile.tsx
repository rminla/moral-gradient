"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";

type NavItem = {
  href: string;
  label: string;
};

type NavSection = {
  title: string;
  items: NavItem[];
};

type NavMobileProps = {
  sections: NavSection[];
  userLink: { href: string; label: string };
};

export function NavMobile({ sections, userLink }: NavMobileProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 border-l border-rule px-4 font-mono text-[12px] uppercase tracking-[0.08em] text-ink/70 hover:text-ink md:hidden"
        aria-label="Menu"
        aria-expanded={isOpen}
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          {isOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
        Menu
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-ink/20 md:hidden"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-sm overflow-y-auto border-l border-rule bg-paper md:hidden">
            <div className="flex items-center justify-between border-b border-rule p-4">
              <span className="font-mono text-[12px] uppercase tracking-[0.08em] text-ink">Menu</span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="flex h-8 w-8 items-center justify-center text-ink/70 hover:text-ink"
                aria-label="Close menu"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <nav className="p-4">
              {sections.map((section, idx) => (
                <div key={section.title} className={idx > 0 ? "mt-6" : ""}>
                  <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.06em] text-ink/50">
                    {section.title}
                  </div>
                  <div className="space-y-1">
                    {section.items.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`block px-3 py-2 font-mono text-[13px] uppercase tracking-[0.06em] transition-colors hover:bg-panel hover:text-ink ${
                          pathname === item.href ? "bg-panel text-ink" : "text-ink/70"
                        }`}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}

              <div className="mt-6 space-y-2 border-t border-rule pt-6">
                <Link
                  href={userLink.href}
                  className="block px-3 py-2 font-mono text-[13px] uppercase tracking-[0.06em] text-ink/70 transition-colors hover:bg-panel hover:text-ink"
                >
                  {userLink.label}
                </Link>
                <Link
                  href="/donate"
                  className="flex items-center justify-center gap-2.5 bg-ink px-4 py-3 font-mono text-[12px] font-medium uppercase tracking-[0.08em] text-white transition-colors hover:bg-vermilion"
                >
                  <span className="blink h-2 w-2 bg-vermilion" />
                  Donate
                </Link>
              </div>
            </nav>
          </div>
        </>
      )}
    </>
  );
}
