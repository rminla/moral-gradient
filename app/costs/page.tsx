import { ExampleBanner, ExampleTag } from "@/components/Banner";
import { PageHead, SectionHead } from "@/components/Brand";
import Leaderboard from "@/components/Leaderboard";
import LiveBudget from "@/components/LiveBudget";
import { NextMilestoneCard, ProgressBar } from "@/components/Milestone";
import { getBundle } from "@/lib/bundle";
import { autoLaunch, jobMode } from "@/lib/config";
import { getFunding, getJobs, getLeaderboard, getRecentDonations, usd } from "@/lib/funding";
import { getSpend } from "@/lib/ledger";

export const dynamic = "force-dynamic";
export const metadata = { title: "Costs & funding" };

const STATUS: Record<string, string> = { queued: "border-rule text-ink/55", funded: "border-vermilion text-vermilion", running: "border-ink bg-ink text-white", published: "border-ink bg-ink text-white", dry_run: "border-rule bg-panel text-ink/70", launch_failed: "border-vermilion bg-vermilion text-white", failed: "border-vermilion bg-vermilion text-white" };
const pt = (s: string) => new Date(s).toLocaleString("en-US", { timeZone: "America/Los_Angeles", dateStyle: "medium", timeStyle: "short" }) + " PT";

export default async function Costs() {
  const [b, f, spend, leaders, recent, jobs] = await Promise.all([getBundle(), getFunding(), getSpend(), getLeaderboard(50), getRecentDonations(10), getJobs()]);
  const all = [...f.done, ...f.queue].sort((a, z) => a.position - z.position);
  return (
    <main>
      <ExampleBanner example={false} examplesInLedger={f.has_examples} />
      <PageHead eyebrow="Costs & funding" grey="Every dollar in." title={<>Every dollar <span className="text-vermilion">out.</span></>}>
        Every model call is written to an append-only cost ledger, priced at each provider&apos;s list price, and shown here within a minute. Every donation is shown too, with its card fee.
      </PageHead>

      <section className="mx-auto grid max-w-[1200px] grid-cols-[minmax(0,1fr)] border-b border-rule md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="p-5 md:p-8"><LiveBudget initial={{ raised_usd: f.raised_cents / 100, pool_usd: f.pool_cents / 100, spent_usd: spend?.total_usd ?? null, spend_source: spend?.source ?? null, spend_as_of: spend?.as_of ?? null, donors: f.donors }} /></div>
        <NextMilestoneCard f={f} showQueue={0} />
      </section>

      <section className="mx-auto grid max-w-[1200px] border-b border-rule md:grid-cols-3 md:divide-x md:divide-rule">
        <div className="border-b border-rule p-5 md:border-b-0 md:p-8">
          <div className="kicker text-ink">Money in</div>
          <dl className="mt-4 space-y-2 text-[14px]">
            <div className="flex justify-between"><dt>Donations (gross)</dt><dd className="num">{usd(f.raised_cents)}</dd></div>
            <div className="flex justify-between text-ink/55"><dt>Card fees</dt><dd className="num">−{usd(f.fees_cents)}</dd></div>
            <div className="flex justify-between border-t border-rule pt-2 font-semibold"><dt>Net</dt><dd className="num">{usd(f.net_cents)}</dd></div>
            {f.direct_cents > 0 && <div className="flex justify-between text-ink/55"><dt>Pilot &amp; methodology compute (paid directly)</dt><dd className="num">−{usd(f.direct_cents)}</dd></div>}
            <div className="flex justify-between text-ink/55"><dt>Committed to funded runs</dt><dd className="num">−{usd(f.allocated_cents)}</dd></div>
            <div className="flex justify-between font-semibold text-vermilion"><dt>Unallocated pool</dt><dd className="num">{usd(f.pool_cents)}</dd></div>
          </dl>
        </div>
        <div className="border-b border-rule p-5 md:border-b-0 md:p-8">
          <div className="kicker text-ink">Spend by model {spend?.source === "live-ledger" && <span className="ml-1 text-vermilion">· live</span>}</div>
          <ul className="mt-4 space-y-2 text-[14px]">{spend?.by_model.map((m) => <li key={m.model} className="flex justify-between gap-2"><span className="min-w-0 truncate">{m.model} <span className="font-mono text-[10.5px] text-ink/40">{m.provider} · {m.calls} calls</span></span><span className="num">${m.usd.toFixed(4)}</span></li>)}</ul>
        </div>
        <div className="p-5 md:p-8">
          <div className="kicker text-ink">Spend by role</div>
          <ul className="mt-4 space-y-2 text-[14px]">{spend?.by_role.map((r) => <li key={r.role} className="flex justify-between"><span className="capitalize">{r.role}</span><span className="num">${r.usd.toFixed(4)}</span></li>)}</ul>
          <div className="mt-3 flex justify-between border-t border-rule pt-2 text-[14px] font-semibold"><span>Total ({spend?.calls} calls)</span><span className="num">${spend?.total_usd.toFixed(4)}</span></div>
          <p className="mt-3 font-mono text-[10.5px] leading-5 text-ink/45">Ledger estimate at list prices; reconciled daily against provider bills. The pilot and methodology compute so far is covered by a $500 donation from Raphael, paid directly (no card fee).</p>
        </div>
      </section>

      <section id="queue" className="mx-auto max-w-[1200px] scroll-mt-16 border-b border-rule px-5 py-14 md:px-8 md:py-16">
        <SectionHead kicker="Funding queue" title="Fills in order.">Donations go into one pool and fill this queue in order. When a strip reaches 100%, that suite launches {autoLaunch() ? "automatically" : "after review"} with a hard spending cap equal to the funded amount, and the next one starts filling. If the queue is empty, money waits in the pool for the next model release. Costs are estimates until a model has been run once.</SectionHead>
        <div className="mt-8 border-t border-ink">
          {all.map((m) => (
            <div key={m.key} className="grid items-center gap-3 border-b border-rule py-4 md:grid-cols-[3rem_1.4fr_2fr_8rem]">
              <div className="num text-[12px] text-ink/40">{String(m.position).padStart(2, "0")}</div>
              <div className="min-w-0"><div className="text-[16px] font-semibold">{m.title}</div><div className="truncate font-mono text-[10.5px] text-ink/45">{m.kind === "model" ? `${m.lab} · ${m.model_id}` : "scenario suite"} · {m.suite}</div></div>
              <div><ProgressBar value={Number(m.funded_cents) / Number(m.cost_cents)} /><div className="mt-1.5 flex justify-between font-mono text-[10.5px] text-ink/50"><span>{usd(m.funded_cents, 0)} of {usd(m.cost_cents, 0)}</span>{m.funded_at && <span>funded {pt(m.funded_at)}</span>}</div></div>
              <div className="md:text-right"><span className={`inline-flex rounded-full border px-2.5 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.06em] ${STATUS[m.status] || "border-rule"}`}>{m.status.replace("_", " ")}</span></div>
            </div>
          ))}
          <div className="hatch py-4 pl-3 text-[14px] text-ink/65">After the queue: <b className="text-ink">general pool</b>, held for the next frontier model the day it ships.</div>
        </div>
      </section>

      {jobs.length > 0 && (
        <section className="mx-auto max-w-[1200px] border-b border-rule px-5 py-14 md:px-8">
          <SectionHead kicker="Launched" title="Launched runs." />
          <div className="mt-8 overflow-x-auto border-t border-ink"><table className="w-full text-[14px]"><tbody>
            {jobs.map((j: any) => (
              <tr key={j.id} className="border-b border-rule">
                <td className="py-3 pr-3 font-medium">{j.title}</td><td className="num p-3 text-xs">cap ${Number(j.cap_usd).toFixed(2)}</td>
                <td className="p-3"><span className={`inline-flex rounded-full border px-2.5 py-0.5 font-mono text-[10.5px] uppercase ${STATUS[j.status] || "border-rule"}`}>{j.status.replace("_", " ")}</span></td>
                <td className="p-3 font-mono text-[11px] text-ink/50">{pt(j.created_at)}</td>
              </tr>
            ))}
          </tbody></table>
          {jobMode() === "dryrun" && <p className="py-3 font-mono text-[11px] text-ink/60">Runner is in dry-run mode: funded suites are recorded but nothing is sent to a model provider.</p>}</div>
        </section>
      )}

      <section id="leaderboard" className="mx-auto grid max-w-[1200px] scroll-mt-16 border-b border-rule md:grid-cols-[1.3fr_1fr] md:divide-x md:divide-rule">
        <div className="border-b border-rule p-5 md:border-b-0 md:p-8"><Leaderboard rows={leaders} /></div>
        <div className="p-5 md:p-8">
          <div className="kicker border-b border-ink pb-3 text-ink">Recent donations</div>
          <ul className="divide-y divide-rule">
            {recent.map((d: any, i: number) => (
              <li key={i} className="py-3 text-[14px]">
                <div className="flex justify-between gap-2"><span className={d.name === "Anonymous" ? "text-ink/55" : "font-medium"}>{d.name} {Number(d.is_example) === 1 && <ExampleTag />}</span><span className="num">{usd(d.amount_cents, 0)}</span></div>
                {d.message && <div className="text-[12px] text-ink/55">&ldquo;{d.message}&rdquo;</div>}
              </li>
            ))}
            {recent.length === 0 && <li className="py-6 text-[15px] text-ink/55">None yet.</li>}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-[1200px] border-b border-rule px-5 py-14 md:px-8">
        <SectionHead kicker="Cost ledger" title="Recent runs." />
        <div className="mt-8 overflow-x-auto border-t border-ink"><table className="w-full min-w-[520px] text-[14px]"><tbody>
          {spend?.runs.slice(0, 12).map((r) => <tr key={r.run_id} className="border-b border-rule"><td className="num py-3 pr-3 text-xs">{r.run_id}</td><td className="p-3 text-ink/60">{r.mode}</td><td className="p-3 font-mono text-[11px] text-ink/50">{pt(r.started_utc)}</td><td className="num p-3 text-right">${r.usd.toFixed(4)}</td></tr>)}
        </tbody></table></div>
      </section>
    </main>
  );
}
