import { NextRequest } from "next/server";
import { proxyToChatServer, requireApiSession } from "@/lib/marvin-server";

export async function GET() {
  const unauthorized = await requireApiSession();
  if (unauthorized) return unauthorized;
  return proxyToChatServer({ path: "/todo-tags" });
}

export async function POST(req: NextRequest) {
  const unauthorized = await requireApiSession();
  if (unauthorized) return unauthorized;
  return proxyToChatServer({ path: "/todo-tags", method: "POST", body: await req.json() });
}
