import { NextRequest } from "next/server";
import { proxyToChatServer, requireApiSession } from "@/lib/marvin-server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(req: NextRequest, context: RouteContext) {
  const unauthorized = await requireApiSession();
  if (unauthorized) return unauthorized;
  const { id } = await context.params;
  return proxyToChatServer({
    path: `/todos/${encodeURIComponent(id)}`,
    method: "PATCH",
    body: await req.json()
  });
}
