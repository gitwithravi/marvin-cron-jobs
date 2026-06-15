import { NextRequest } from "next/server";
import { proxyToMarvinApi, requireApiSession } from "@/lib/marvin-server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(req: NextRequest, context: RouteContext) {
  const unauthorized = await requireApiSession();
  if (unauthorized) return unauthorized;
  const { id } = await context.params;
  return proxyToMarvinApi({
    path: `/todos/${encodeURIComponent(id)}/retag`,
    method: "POST",
    body: await req.json()
  });
}
