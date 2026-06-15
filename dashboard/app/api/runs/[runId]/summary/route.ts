import { NextRequest } from "next/server";
import { proxyToChatServer, requireApiSession } from "@/lib/marvin-server";

type Params = {
  params: Promise<{ runId: string }>;
};

export async function POST(req: NextRequest, { params }: Params) {
  const unauthorized = await requireApiSession();
  if (unauthorized) return unauthorized;
  const { runId } = await params;
  const search = req.nextUrl.searchParams.toString();
  const path = search ? `/runs/${runId}/summary?${search}` : `/runs/${runId}/summary`;
  return proxyToChatServer({ path, method: "POST" });
}
