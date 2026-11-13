import Link from "next/link";
import Image from "next/image";
import { currentUser } from "@/lib/auth";
import { Wordmark } from "./Brand";
import { NavContent } from "./NavContent";
import { SITE_NAME } from "@/lib/config";

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
          <Link href="/" aria-label="Moral Gradient, home" className="flex shrink-0 items-center gap-2.5 border-r border-rule px-4 2xl:px-5">
            <Image src="/moral-gradient-logomark.svg" alt="" width={28} height={28} className="shrink-0" aria-hidden="true" />
            <span className="wide text-[17px] font-bold uppercase leading-none tracking-[-0.01em]">{SITE_NAME}</span>
          </Link>
          <NavContent userLink={userLink} />
        </div>
      </header>
    </>
  );
}
