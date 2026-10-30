import Link from "next/link";
import { Eyebrow } from "@/components/Brand";

export default function NotFound() {
  return (
    <main>
      <section className="relative mx-auto max-w-[1200px] overflow-hidden border-b border-rule">
        <div aria-hidden className="pixel-grid absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
        <div className="relative mx-auto flex max-w-2xl flex-col items-center px-5 py-20 text-center md:py-28">
          <Eyebrow>Error 404</Eyebrow>
          <div aria-hidden className="mt-8 grid grid-cols-5 gap-1.5">
            {Array.from({ length: 15 }, (_, i) => <span key={i} className={`h-5 w-5 md:h-6 md:w-6 ${i === 12 ? "bg-vermilion" : [0, 2, 4, 5, 6, 7, 9, 14].includes(i) ? "bg-ink" : "bg-panel"}`} />)}
          </div>
          <h1 className="wide mt-8 text-[48px] font-bold leading-none tracking-[-0.045em] md:text-[80px]">Not <span className="text-vermilion">here.</span></h1>
          <p className="mt-5 text-[17px] text-ink/65">That page doesn&apos;t exist, or it&apos;s a private hold-out item.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3"><Link href="/results" className="btn-primary">Back to results</Link><Link href="/" className="btn-ghost">Home</Link></div>
        </div>
      </section>
    </main>
  );
}
