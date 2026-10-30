import Link from "next/link";
import { usd, type LeaderRow } from "@/lib/funding";
import { ExampleTag } from "./Banner";

export default function Leaderboard({ rows, title = "Contribution leaderboard" }: { rows: LeaderRow[]; title?: string }) {
  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-baseline justify-between border-b-2 border-ink pb-2">
        <div className="kicker text-ink">{title}</div>
        <Link href="/costs#leaderboard" className="font-sans text-xs text-ink/55 hover:text-vermilion">All contributors →</Link>
      </div>
      {rows.length === 0 ? (
        <p className="py-3 font-serif text-[16px] italic text-ink/60">No donations yet. Be the first name on the board.</p>
      ) : (
        <ol>
          {rows.map((r, i) => (
            <li key={r.name + i} className="flex items-baseline gap-3 border-b border-ink/10 py-2.5">
              <span className={`num w-6 text-right text-xs ${i < 3 ? "text-vermilion" : "text-ink/40"}`}>{String(i + 1).padStart(2, "0")}</span>
              <span className="min-w-0 flex-1 truncate font-serif text-[17px]">
                {r.link ? <a href={r.link} target="_blank" rel="noopener noreferrer nofollow ugc" className="link">{r.name}</a> : <span className={r.anonymous ? "italic text-ink/55" : ""}>{r.name}</span>}
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
