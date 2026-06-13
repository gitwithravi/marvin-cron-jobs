import { NextRequest } from "next/server";
import { proxyToChatServer, requireApiSession, searchPath } from "@/lib/marvin-server";

export async function GET(req: NextRequest) {
  const unauthorized = await requireApiSession();
  if (unauthorized) return unauthorized;
  return proxyToChatServer({ path: searchPath(req, "/todos") });
}

export async function POST(req: NextRequest) {
  const unauthorized = await requireApiSession();
  if (unauthorized) return unauthorized;
  return proxyToChatServer({ path: "/todos", method: "POST", body: await req.json() });
}
