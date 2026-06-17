import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

type ProxyOptions = {
  path: string;
  method?: string;
  body?: unknown;
};

export function marvinApiBaseUrl() {
  const marvinApiPort = process.env.MARVIN_API_PORT || "3031";
  return `http://127.0.0.1:${marvinApiPort}`;
}

export async function proxyToMarvinApi({ path, method = "GET", body }: ProxyOptions) {
  let response: Response;
  try {
    response = await fetch(`${marvinApiBaseUrl()}${path}`, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  } catch {
    return NextResponse.json(
      { error: "MARVIN API is unavailable." },
      { status: 503 }
    );
  }

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
    return NextResponse.json(data ?? { error: "MARVIN API error" }, { status: response.status });
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
