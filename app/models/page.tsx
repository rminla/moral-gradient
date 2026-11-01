import Link from "next/link";
import { PageHead } from "@/components/Brand";
import { Block, FidelityTag, PreviewBanner } from "@/components/V3";
import { WeakSpots } from "@/components/WeakSpots";
import { getV3, modelIds, weakSpots } from "@/lib/v3";
import { modelMeta, modelSlug } from "@/lib/v3meta";

export const dynamic = "force-dynamic";
export const metadata = { title: "Models", description: "Each model's weak spots: where it is most swayed, most self-interested, most test-aware." };

export default async function Models() {
  const v = await getV3();
  const ids = modelIds(v);
  return (
    <main>
      <PreviewBanner v={v} />
      <PageHead eyebrow="Models" grey="Every model has a weak spot." title={<>Here&apos;s where each one <span className="text-vermilion">bends.</span></>}>
        For each model: where social pressure moves it most, where a stake of its own moves it most, whether it suspects a test, where its words and deeds part, and how often its reasoning weighs something its stated reasons leave out.
      </PageHead>
      <Block>
        <div className="grid gap-4 md:grid-cols-2">
          {ids.map((id) => {
            const m = modelMeta(id);
            return (
              <article key={id} className="ticks border border-rule">
                <Link href={`/models/${modelSlug(id)}`} className="flex items-start justify-between gap-3 border-b border-rule p-5 hover:bg-panel">
                  <div>
                    <div className="wide text-[22px] font-bold tracking-[-0.03em]">{m.name}</div>
                    <div className="mt-1 font-mono text-[11px] text-ink/50">{m.lab}</div>
                  </div>
                  <FidelityTag fidelity={m.trace} />
                </Link>
                <WeakSpots spots={weakSpots(v, id)} compact />
                <Link href={`/models/${modelSlug(id)}`} className="block px-5 py-3 font-mono text-[11px] uppercase tracking-[0.06em] text-ink/60 hover:text-vermilion">Full profile →</Link>
              </article>
            );
          })}
        </div>
        <p className="mt-6 max-w-3xl text-[13.5px] leading-6 text-ink/55">Shifts are in percentage points against a matched control; rates are shares of runs. A missing value means the measurement hasn&apos;t run for that model, or (for test awareness) its validity check didn&apos;t pass.</p>
      </Block>
    </main>
  );
}
