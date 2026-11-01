import { redirect } from "next/navigation";

// v2 per-scenario pages are retired; v3 compares every model per scenario on /compare.
const MAP: Record<string, string> = { "SD-CAR-01": "car", "SD-HON-02": "hon" };
export default async function RetiredScenario({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const key = MAP[id] ?? (/fb|footbridge/i.test(id) ? "fb" : /switch|sw/i.test(id) ? "sw" : /loop/i.test(id) ? "lp" : "");
  redirect(key ? `/compare#${key}` : "/compare");
}
