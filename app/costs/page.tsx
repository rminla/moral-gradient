import { ExampleBanner, ExampleTag } from "@/components/Banner";
import Leaderboard from "@/components/Leaderboard";
import LiveBudget from "@/components/LiveBudget";
import { NextMilestoneCard, ProgressBar } from "@/components/Milestone";
import { getBundle } from "@/lib/bundle";
import { autoLaunch, jobMode } from "@/lib/config";
import { getFunding, getJobs, getLeaderboard, getRecentDonations, usd } from "@/lib/funding";
import { getSpend } from "@/lib/ledger";

export const dynamic = "force-dynamic";
export const metadata = { title: "Costs & funding" };

const STATUS: Record<string, string> = { queued: "bg-ink/5 text-ink/60", funded: "bg-moss/10 text-moss", running: "bg-prussian/10 text-prussian", published: "bg-ink text-paper", launch_failed: "bg-red-100 text-vermilion-dark", failed: "bg-red-100 text-vermilion-dark" };
const pt = (s: string) => new Date(s).toLocaleString("en-US", { timeZone: "America/Los_Angeles", dateStyle: "medium", timeStyle: "short" }) + " PT";

export default async function Costs() {
  const [b, f, spend, leaders, recent, jobs] = await Promise.all([getBundle(), getFunding(), getSpend(), getLeaderboard(50), getRecentDonations(10), getJobs()]);
  const all = [...f.done, ...f.queue].sort((a, z) => a.position - z.position);
  return (
    <main>
      <ExampleBanner example={false} examplesInLedger={f.has_examples} />
      <div className="mx-auto max-w-6xl px-5 py-12">
        <h1 className="serif text-[44px] leading-[1.05] tracking-[-0.02em]">Costs &amp; funding</h1>
        <p className="mt-2 max-w-2xl text-ink/60">Every model call is written to an append-only cost ledger, priced at each provider&apos;s list price, and shown here within a minute. Every donation is shown too, with its card fee.</p>

        <div className="mt-8 grid gap-4 md:grid-cols-[1.3fr_1fr]">
          <LiveBudget initial={{ raised_usd: f.raised_cents / 100, pool_usd: f.pool_cents / 100, spent_usd: spend?.total_usd ?? null, spend_source: spend?.source ?? null, spend_as_of: spend?.as_of ?? null, donors: f.donors }} />
          <NextMilestoneCard f={f} showQueue={0} />
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="card p-5">
            <div className="label">Money in</div>
            <dl className="mt-2 space-y-1.5 text-sm">
              <div className="flex justify-between"><dt>Donations (gross)</dt><dd className="num">{usd(f.raised_cents)}</dd></div>
              <div className="flex justify-between text-ink/60"><dt>Card fees</dt><dd className="num">−{usd(f.fees_cents)}</dd></div>
              <div className="flex justify-between border-t border-ink/10 pt-1.5 font-semibold"><dt>Net</dt><dd className="num">{usd(f.net_cents)}</dd></div>
              <div className="flex justify-between text-ink/60"><dt>Committed to funded runs</dt><dd className="num">−{usd(f.allocated_cents)}</dd></div>
              <div className="flex justify-between font-semibold text-money"><dt>Unallocated pool</dt><dd className="num">{usd(f.pool_cents)}</dd></div>
            </dl>
          </div>
          <div className="card p-5">
            <div className="label">Spend by model {spend?.source === "live-ledger" && <span className="ml-1 normal-case text-moss">· live</span>}</div>
            <ul className="mt-2 space-y-1.5 text-sm">{spend?.by_model.map((m) => <li key={m.model} className="flex justify-between gap-2"><span className="truncate">{m.model} <span className="text-xs text-ink/40">{m.provider} · {m.calls} calls</span></span><span className="num">${m.usd.toFixed(4)}</span></li>)}</ul>
          </div>
          <div className="card p-5">
            <div className="label">Spend by role</div>
            <ul className="mt-2 space-y-1.5 text-sm">{spend?.by_role.map((r) => <li key={r.role} className="flex justify-between"><span className="capitalize">{r.role}</span><span className="num">${r.usd.toFixed(4)}</span></li>)}</ul>
            <div className="mt-3 border-t border-ink/10 pt-2 text-sm font-semibold flex justify-between"><span>Total ({spend?.calls} calls)</span><span className="num">${spend?.total_usd.toFixed(4)}</span></div>
            <p className="mt-2 text-[11px] text-ink/45">Ledger estimate at list prices; reconciled daily against provider bills. Pilot costs so far were paid by Raphael.</p>
          </div>
        </div>

        <section id="queue" className="mt-14">
          <h2 className="serif text-[28px] tracking-[-0.01em]">Funding queue</h2>
          <p className="mt-1 max-w-2xl text-sm text-ink/60">Donations go into one pool and fill this queue in order. When a bar reaches 100%, that suite launches {autoLaunch() ? "automatically" : "after review"} with a hard spending cap equal to the funded amount, and the next bar starts filling. If the queue is empty, money waits in the pool for the next model release. Costs are estimates until a model has been run once.</p>
          <div className="card mt-4 divide-y divide-ink/5">
            {all.map((m) => (
              <div key={m.key} className="grid items-center gap-3 p-4 md:grid-cols-[2rem_1.4fr_2fr_7rem]">
                <div className="num text-xs text-ink/40">#{m.position}</div>
                <div><div className="font-medium">{m.title}</div><div className="text-xs text-ink/45">{m.kind === "model" ? `${m.lab} · ${m.model_id}` : "scenario suite"} · {m.suite}</div></div>
                <div><ProgressBar value={Number(m.funded_cents) / Number(m.cost_cents)} /><div className="mt-1 flex justify-between text-xs text-ink/50"><span className="num">{usd(m.funded_cents, 0)} of {usd(m.cost_cents, 0)}</span>{m.funded_at && <span>funded {pt(m.funded_at)}</span>}</div></div>
                <div className="text-right"><span className={`px-2 py-1 text-xs font-semibold ${STATUS[m.status] || "bg-ink/5"}`}>{m.status.replace("_", " ")}</span></div>
              </div>
            ))}
            <div className="p-4 text-sm text-ink/55">After the queue: <b>general pool</b>, held for the next frontier model the day it ships.</div>
          </div>
        </section>

        {jobs.length > 0 && (
          <section className="mt-10">
            <h2 className="serif text-[28px] tracking-[-0.01em]">Launched runs</h2>
            <div className="card mt-4 overflow-x-auto"><table className="w-full text-sm"><tbody>
              {jobs.map((j: any) => (
                <tr key={j.id} className="border-b border-ink/5 last:border-0">
                  <td className="p-3 font-medium">{j.title}</td><td className="p-3 num text-xs">cap ${Number(j.cap_usd).toFixed(2)}</td>
                  <td className="p-3"><span className={`px-2 py-0.5 text-xs font-semibold ${j.status === "dry_run" ? "bg-highlight text-ink" : STATUS[j.status] || "bg-ink/5"}`}>{j.status.replace("_", " ")}</span></td>
                  <td className="p-3 text-xs text-ink/50">{pt(j.created_at)}</td>
                </tr>
              ))}
            </tbody></table>
            {jobMode() === "dryrun" && <p className="border-t border-ink/5 p-3 text-xs text-ink/70 bg-highlight/50 px-1">Runner is in dry-run mode: funded suites are recorded but nothing is sent to a model provider.</p>}</div>
          </section>
        )}

        <section id="leaderboard" className="mt-14 grid gap-4 md:grid-cols-[1.3fr_1fr]">
          <Leaderboard rows={leaders} />
          <div className="card p-5">
            <div className="label">Recent donations</div>
            <ul className="mt-2 divide-y divide-ink/5">
              {recent.map((d: any, i: number) => (
                <li key={i} className="py-2 text-sm">
                  <div className="flex justify-between"><span className={d.name === "Anonymous" ? "italic text-ink/55" : "font-medium"}>{d.name} {Number(d.is_example) === 1 && <ExampleTag />}</span><span className="num">{usd(d.amount_cents, 0)}</span></div>
                  {d.message && <div className="text-xs text-ink/55">&ldquo;{d.message}&rdquo;</div>}
                </li>
              ))}
              {recent.length === 0 && <li className="py-2 text-sm text-ink/55">None yet.</li>}
            </ul>
          </div>
        </section>

        <section className="mt-14">
          <h2 className="serif text-[28px] tracking-[-0.01em]">Recent runs (cost ledger)</h2>
          <div className="card mt-4 overflow-x-auto"><table className="w-full text-sm"><tbody>
            {spend?.runs.slice(0, 12).map((r) => <tr key={r.run_id} className="border-b border-ink/5 last:border-0"><td className="p-3 num text-xs">{r.run_id}</td><td className="p-3 text-ink/60">{r.mode}</td><td className="p-3 text-xs text-ink/50">{pt(r.started_utc)}</td><td className="p-3 text-right num">${r.usd.toFixed(4)}</td></tr>)}
          </tbody></table></div>
        </section>
      </div>
    </main>
  );
}
