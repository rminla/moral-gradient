import { NextResponse } from "next/server";
import { endSession } from "@/lib/auth";
import { SITE_URL } from "@/lib/config";
export async function POST() {
  await endSession();
  return NextResponse.redirect(new URL("/", SITE_URL), 303);
}
