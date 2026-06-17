import { NextRequest } from "next/server";
import { proxyToMarvinApi, requireApiSession } from "@/lib/marvin-server";

export async function POST(req: NextRequest) {
  const unauthorized = await requireApiSession();
  if (unauthorized) return unauthorized;
  const search = req.nextUrl.searchParams.toString();
  const path = search ? `/agent-runs/support-reply/sync?${search}` : "/agent-runs/support-reply/sync";
  return proxyToMarvinApi({ path, method: "POST" });
}
