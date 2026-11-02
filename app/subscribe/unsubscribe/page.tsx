import { Eyebrow } from "@/components/Brand";

export const metadata = { title: "Unsubscribe", robots: { index: false } };

export default async function Unsub({ searchParams }: { searchParams: Promise<{ id?: string; sig?: string }> }) {
  const { id = "", sig = "" } = await searchParams;
  return (
    <main>
      <section className="mx-auto max-w-xl px-5 py-16 md:py-24">
        <Eyebrow>New findings by email</Eyebrow>
        <h1 className="wide mt-6 text-[40px] font-bold leading-none tracking-[-0.045em] md:text-[52px]">Unsubscribe<span className="text-vermilion">?</span></h1>
        <p className="mt-4 text-[16px] text-ink/65">You&apos;ll stop getting emails about new findings.</p>
        <form action="/api/subscribe/unsubscribe" method="post" className="mt-8">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="sig" value={sig} />
          <button className="btn-primary">Unsubscribe me</button>
        </form>
      </section>
    </main>
  );
}
