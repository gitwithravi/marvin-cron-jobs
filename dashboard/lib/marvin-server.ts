import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

type ProxyOptions = {
  path: string;
  method?: string;
  body?: unknown;
};

export function chatServerBaseUrl() {
  const chatServerPort = process.env.CHAT_SERVER_PORT || "3031";
  return `http://127.0.0.1:${chatServerPort}`;
}

export async function proxyToChatServer({ path, method = "GET", body }: ProxyOptions) {
  const response = await fetch(`${chatServerBaseUrl()}${path}`, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text };
    }
  }

  if (!response.ok) {
    return NextResponse.json(data ?? { error: "Chat server error" }, { status: response.status });
  }
  return NextResponse.json(data);
}

export async function requireApiSession() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export function searchPath(req: NextRequest, basePath: string) {
  const search = req.nextUrl.searchParams.toString();
  return search ? `${basePath}?${search}` : basePath;
}
