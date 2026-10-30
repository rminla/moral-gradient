import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { SITE_URL } from "@/lib/config";
import { q } from "@/lib/db";

export async function POST(req: Request) {
  const u = await currentUser();
  if (!u) return NextResponse.redirect(new URL("/signin", SITE_URL), 303);
  const f = await req.formData();
  const name = String(f.get("display_name") || "").trim().slice(0, 60) || null;
  let link = String(f.get("link_url") || "").trim().slice(0, 200) || null;
  if (link && !/^https:\/\/[^\s]+$/.test(link)) link = null; // https links only on the public leaderboard
  await q("UPDATE users SET display_name=?, link_url=? WHERE id=?", [name, link, u.id]);
  return NextResponse.redirect(new URL("/account?saved=1", SITE_URL), 303);
}
