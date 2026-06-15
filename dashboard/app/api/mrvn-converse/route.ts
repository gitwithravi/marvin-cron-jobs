import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { marvinApiBaseUrl } from "@/lib/marvin-server";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const message = body.message;
    if (typeof message !== "string") {
      return NextResponse.json({ error: "Message must be a string" }, { status: 400 });
    }

    const marvinApiUrl = `${marvinApiBaseUrl()}/chat`;

    const response = await fetch(marvinApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `MARVIN API error: ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
