import { NextResponse } from "next/server";
import { clearSession } from "@/lib/auth";
import { appRedirectUrl } from "@/lib/redirects";

export async function POST(request: Request) {
  await clearSession();
  return NextResponse.redirect(appRedirectUrl(request, "/login"), 303);
}
