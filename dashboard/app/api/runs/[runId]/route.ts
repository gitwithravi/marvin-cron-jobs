import { NextRequest } from "next/server";
import { proxyToChatServer, requireApiSession } from "@/lib/marvin-server";

type Params = {
  params: Promise<{ runId: string }>;
};

export async function GET(req: NextRequest, { params }: Params) {
  const unauthorized = await requireApiSession();
  if (unauthorized) return unauthorized;
  const { runId } = await params;
  const search = req.nextUrl.searchParams.toString();
  const path = search ? `/runs/${runId}?${search}` : `/runs/${runId}`;
  return proxyToChatServer({ path });
}
