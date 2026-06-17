import { NextResponse } from "next/server";
import { createSession, validateCredentials } from "@/lib/auth";
import { appRedirectUrl } from "@/lib/redirects";

export async function POST(request: Request) {
  const formData = await request.formData();
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  try {
    if (!validateCredentials(username, password)) {
      return NextResponse.redirect(appRedirectUrl(request, "/login?error=invalid"), 303);
    }
    await createSession(username);
    return NextResponse.redirect(appRedirectUrl(request, "/console"), 303);
  } catch {
    return NextResponse.redirect(appRedirectUrl(request, "/login?error=config"), 303);
  }
}
