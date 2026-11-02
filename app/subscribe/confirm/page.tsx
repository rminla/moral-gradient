import { Eyebrow } from "@/components/Brand";

export const metadata = { title: "Confirm your email", robots: { index: false } };

export default async function Confirm({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  return (
    <main>
      <section className="mx-auto max-w-xl px-5 py-16 md:py-24">
        <Eyebrow>New findings by email</Eyebrow>
        <h1 className="wide mt-6 text-[40px] font-bold leading-none tracking-[-0.045em] md:text-[52px]">One click to <span className="text-vermilion">confirm.</span></h1>
        <p className="mt-4 text-[16px] text-ink/65">Press the button to start getting new findings. If you didn&apos;t ask for this, just close the page and nothing happens.</p>
        <form action="/api/subscribe/confirm" method="post" className="mt-8">
          <input type="hidden" name="token" value={token} />
          <button className="btn-primary">Yes, add me to the list</button>
        </form>
      </section>
    </main>
  );
}
