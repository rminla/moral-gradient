import { NextResponse } from "next/server";
import { getFunding } from "@/lib/funding";
import { getSpend } from "@/lib/ledger";

export const dynamic = "force-dynamic";
export async function GET() {
  const [f, s] = await Promise.all([getFunding(), getSpend()]);
  return NextResponse.json({
    raised_usd: f.raised_cents / 100, net_usd: f.net_cents / 100, pool_usd: f.pool_cents / 100, donors: f.donors,
    spent_usd: s?.total_usd ?? null, spend_source: s?.source ?? null, spend_as_of: s?.as_of ?? null,
    next: f.next && { title: f.next.title, kind: f.next.kind, cost_usd: f.next.cost_cents / 100, funded_usd: f.next.funded_cents / 100, remaining_usd: f.next.remaining_cents / 100, progress: f.next.progress },
  }, { headers: { "cache-control": "no-store" } });
}
