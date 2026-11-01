import { NextResponse } from "next/server";
import { getV3 } from "@/lib/v3";

export const dynamic = "force-dynamic";
/** The full v3 results bundle behind every chart (aggregates only: counts, rates, intervals, curated quotes). */
export async function GET() {
  const v = await getV3();
  return NextResponse.json(v, { headers: { "cache-control": "public, max-age=300", "content-disposition": "inline; filename=moral-gradient-v3.json" } });
}
