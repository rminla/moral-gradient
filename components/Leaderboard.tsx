import Link from "next/link";
import { usd, type LeaderRow } from "@/lib/funding";
import { ExampleTag } from "./Banner";

export default function Leaderboard({ rows, title = "Contribution leaderboard" }: { rows: LeaderRow[]; title?: string }) {
  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="label !mb-0">{title}</div>
        <Link href="/costs#leaderboard" className="text-xs font-semibold text-black/50 hover:text-black">All →</Link>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-black/55">No donations yet. Be the first name on the board.</p>
      ) : (
        <ol className="divide-y divide-black/5">
          {rows.map((r, i) => (
            <li key={r.name + i} className="flex items-center gap-3 py-2.5">
              <span className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${i === 0 ? "bg-amber-100 text-amber-800" : i === 1 ? "bg-zinc-100 text-zinc-700" : i === 2 ? "bg-orange-100 text-orange-800" : "bg-black/5 text-black/50"}`}>{i + 1}</span>
              <span className="min-w-0 flex-1 truncate text-sm">
                {r.link ? <a href={r.link} target="_blank" rel="noopener noreferrer nofollow ugc" className="font-medium underline decoration-black/20 underline-offset-2 hover:decoration-black">{r.name}</a> : <span className={r.anonymous ? "italic text-black/55" : "font-medium"}>{r.name}</span>}
                {r.example && <span className="ml-2"><ExampleTag /></span>}
              </span>
              <span className="font-mono text-sm tabular-nums">{usd(r.total_cents, 0)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
