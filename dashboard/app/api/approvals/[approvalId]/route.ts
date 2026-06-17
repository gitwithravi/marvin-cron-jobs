import { NextRequest } from "next/server";
import { proxyToMarvinApi, requireApiSession } from "@/lib/marvin-server";

type Params = {
  params: Promise<{ approvalId: string }>;
};

export async function GET(_req: NextRequest, { params }: Params) {
  const unauthorized = await requireApiSession();
  if (unauthorized) return unauthorized;
  const { approvalId } = await params;
  return proxyToMarvinApi({ path: `/approvals/${approvalId}` });
}
