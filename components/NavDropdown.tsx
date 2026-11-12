"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";

type DropdownItem = {
  href: string;
  label: string;
};

type NavDropdownProps = {
  label: string;
  href?: string;
  items: DropdownItem[];
};

export function NavDropdown({ label, href, items }: NavDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const timeoutRef = useRef<NodeJS.Timeout>();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  const isActive = href === pathname || items.some((item) => item.href === pathname);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setFocusedIndex(-1);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
      setFocusedIndex(-1);
    }, 150);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsOpen(false);
      setFocusedIndex(-1);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setIsOpen(true);
      setFocusedIndex((prev) => (prev + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIsOpen(true);
      setFocusedIndex((prev) => (prev - 1 + items.length) % items.length);
    } else if (e.key === "Enter" || e.key === " ") {
      if (!isOpen) {
        e.preventDefault();
        setIsOpen(true);
        setFocusedIndex(0);
      }
    }
  };

  useEffect(() => {
    if (focusedIndex >= 0 && dropdownRef.current) {
      const links = dropdownRef.current.querySelectorAll("a");
      if (links[focusedIndex]) {
        (links[focusedIndex] as HTMLElement).focus();
      }
    }
  }, [focusedIndex]);

  return (
    <div
      ref={dropdownRef}
      className="relative flex items-stretch"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {href ? (
        <Link
          href={href}
          className={`flex items-center whitespace-nowrap border-r border-rule px-3 font-mono text-[11.5px] uppercase tracking-[0.06em] transition-colors hover:bg-panel hover:text-ink xl:px-4 xl:text-[12px] xl:tracking-[0.08em] ${
            isActive ? "text-ink" : "text-ink/70"
          }`}
          onKeyDown={handleKeyDown}
          aria-expanded={isOpen}
          aria-haspopup="true"
        >
          {label}
          <svg
            className="ml-1 h-3 w-3 transition-transform"
            style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </Link>
      ) : (
        <button
          type="button"
          className={`flex items-center whitespace-nowrap border-r border-rule px-3 font-mono text-[11.5px] uppercase tracking-[0.06em] transition-colors hover:bg-panel hover:text-ink xl:px-4 xl:text-[12px] xl:tracking-[0.08em] ${
            isActive ? "text-ink" : "text-ink/70"
          }`}
          onClick={() => setIsOpen(!isOpen)}
          onKeyDown={handleKeyDown}
          aria-expanded={isOpen}
          aria-haspopup="true"
        >
          {label}
          <svg
            className="ml-1 h-3 w-3 transition-transform"
            style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      )}

      {isOpen && (
        <div
          className="absolute left-0 top-full z-50 min-w-[200px] border border-rule bg-paper shadow-lg"
          role="menu"
        >
          {items.map((item, index) => (
            <Link
              key={item.href}
              href={item.href}
              className={`block border-b border-rule px-4 py-3 font-mono text-[11.5px] uppercase tracking-[0.06em] last:border-b-0 hover:bg-panel hover:text-ink ${
                pathname === item.href ? "bg-panel text-ink" : "text-ink/70"
              }`}
              role="menuitem"
              tabIndex={focusedIndex === index ? 0 : -1}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  window.location.href = item.href;
                } else if (e.key === "Escape") {
                  setIsOpen(false);
                  setFocusedIndex(-1);
                }
              }}
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
