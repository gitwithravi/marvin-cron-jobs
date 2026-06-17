import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { proxyToMarvinApi } from "@/lib/marvin-server";

type Params = {
  params: Promise<{ approvalId: string }>;
};

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { approvalId } = await params;
  const body = await req.json();
  return proxyToMarvinApi({
    path: `/approvals/${approvalId}/reject`,
    method: "POST",
    body: {
      ...body,
      reviewer: session.username
    }
  });
}
