import { NextRequest } from "next/server";
import { proxyToMarvinApi, requireApiSession } from "@/lib/marvin-server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ taskName: string }> }
) {
  const unauthorized = await requireApiSession();
  if (unauthorized) return unauthorized;
  const { taskName } = await params;
  return proxyToMarvinApi({ path: `/tasks/${encodeURIComponent(taskName)}/run`, method: "POST" });
}
