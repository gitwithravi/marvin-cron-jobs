import { NextRequest, NextResponse } from "next/server";
import { marvinApiBaseUrl } from "@/lib/marvin-server";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-marvin-email-secret");
  if (!secret || secret !== process.env.MARVIN_EMAIL_CAPTURE_SECRET) {
    return NextResponse.json({ success: false, error: "Invalid email capture secret." }, { status: 401 });
  }

  let response: Response;
  try {
    response = await fetch(`${marvinApiBaseUrl()}/email-capture`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Marvin-Email-Secret": secret
      },
      body: JSON.stringify(await req.json())
    });
  } catch {
    return NextResponse.json({ success: false, error: "MARVIN API is unavailable." }, { status: 503 });
  }

  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { success: false, error: text };
    }
  }
  return NextResponse.json(data ?? { success: response.ok }, { status: response.status });
}
