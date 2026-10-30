import Link from "next/link";
import { GradientRule } from "@/components/Brand";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl px-5 py-24 text-center">
      <div className="num text-sm text-vermilion">404</div>
      <h1 className="serif mt-2 text-[56px] italic leading-none tracking-[-0.02em]">Not here.</h1>
      <p className="mt-4 font-serif text-[18px] text-ink/70">That page doesn&apos;t exist, or it&apos;s a private hold-out item.</p>
      <GradientRule className="mx-auto mt-8 max-w-xs" />
      <Link href="/results" className="btn-primary mt-8">Back to results</Link>
    </main>
  );
}
