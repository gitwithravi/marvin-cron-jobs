import { NextRequest } from "next/server";
import { proxyToMarvinApi, requireApiSession } from "@/lib/marvin-server";

export async function POST(req: NextRequest) {
  const unauthorized = await requireApiSession();
  if (unauthorized) return unauthorized;
  return proxyToMarvinApi({ path: "/support-rag/index", method: "POST", body: await req.json() });
}
