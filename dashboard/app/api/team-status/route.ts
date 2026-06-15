import { NextRequest } from "next/server";
import { proxyToMarvinApi, requireApiSession, searchPath } from "@/lib/marvin-server";

export async function GET(req: NextRequest) {
  const unauthorized = await requireApiSession();
  if (unauthorized) return unauthorized;
  return proxyToMarvinApi({ path: searchPath(req, "/team-status") });
}
