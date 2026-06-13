import { proxyToChatServer, requireApiSession } from "@/lib/marvin-server";

export async function GET() {
  const unauthorized = await requireApiSession();
  if (unauthorized) return unauthorized;
  return proxyToChatServer({ path: "/alerts/latest" });
}
