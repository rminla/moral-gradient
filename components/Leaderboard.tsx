import Link from "next/link";
import { usd, type LeaderRow } from "@/lib/funding";
import { ExampleTag } from "./Banner";

export default function Leaderboard({ rows, title = "Contribution leaderboard" }: { rows: LeaderRow[]; title?: string }) {
  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-baseline justify-between border-b border-ink pb-3">
        <div className="kicker text-ink">{title}</div>
        <Link href="/costs#leaderboard" className="font-mono text-[11px] uppercase tracking-[0.06em] text-ink/55 hover:text-vermilion">All contributors →</Link>
      </div>
      {rows.length === 0 ? (
        <div className="flex items-center gap-4 py-6">
          <div className="grid shrink-0 grid-cols-3 gap-[3px]">{Array.from({ length: 9 }, (_, i) => <span key={i} className={`h-2.5 w-2.5 ${i === 8 ? "bg-vermilion" : "border border-rule"}`} />)}</div>
          <p className="text-[15px] text-ink/65">No donations yet. <Link href="/donate" className="link font-semibold text-ink">Be the first name on the board.</Link></p>
        </div>
      ) : (
        <ol>
          {rows.map((r, i) => (
            <li key={r.name + i} className="flex items-baseline gap-3 border-b border-rule py-3">
              <span className={`num w-6 text-right text-xs ${i < 3 ? "text-vermilion" : "text-ink/40"}`}>{String(i + 1).padStart(2, "0")}</span>
              <span className="min-w-0 flex-1 truncate text-[16px] font-medium">
                {r.link ? <a href={r.link} target="_blank" rel="noopener noreferrer nofollow ugc" className="link">{r.name}</a> : <span className={r.anonymous ? "font-normal text-ink/55" : ""}>{r.name}</span>}
                {r.example && <span className="ml-2 align-middle"><ExampleTag /></span>}
              </span>
              <span className="num text-sm">{usd(r.total_cents, 0)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
