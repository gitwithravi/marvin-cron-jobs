import { NextResponse } from "next/server";
import { clearSession } from "@/lib/server/auth";
import { appRedirectUrl } from "@/lib/server/redirects";

export async function POST(request: Request) {
  await clearSession();
  return NextResponse.redirect(appRedirectUrl(request, "/login"), 303);
}
