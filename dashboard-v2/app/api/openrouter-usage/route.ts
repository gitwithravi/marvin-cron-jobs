import { NextResponse } from "next/server";
import { getOpenRouterAccountUsage } from "@/lib/server/openrouter-usage";
import { requireApiSession } from "@/lib/server/marvin-server";

export async function GET() {
  const unauthorized = await requireApiSession();
  if (unauthorized) {
    return unauthorized;
  }

  const result = await getOpenRouterAccountUsage();
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 503 });
  }

  return NextResponse.json(result.usage);
}
