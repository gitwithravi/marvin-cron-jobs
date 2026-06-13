import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { task_name, confirmed, params } = body;
    if (typeof task_name !== "string" || typeof confirmed !== "boolean") {
      return NextResponse.json(
        { error: "Invalid task_name or confirmed parameter" },
        { status: 400 }
      );
    }
    if (params !== undefined && (params === null || typeof params !== "object" || Array.isArray(params))) {
      return NextResponse.json(
        { error: "Invalid params parameter" },
        { status: 400 }
      );
    }

    const chatServerPort = process.env.CHAT_SERVER_PORT || "3031";
    const chatServerUrl = `http://127.0.0.1:${chatServerPort}/chat/confirm`;

    const response = await fetch(chatServerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ task_name, confirmed, params: params ?? {} }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Chat server error: ${errorText}` },
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
