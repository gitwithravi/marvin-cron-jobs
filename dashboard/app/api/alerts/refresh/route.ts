import { proxyToChatServer, requireApiSession } from "@/lib/marvin-server";

export async function POST() {
  const unauthorized = await requireApiSession();
  if (unauthorized) return unauthorized;
  return proxyToChatServer({ path: "/alerts/refresh", method: "POST" });
}
