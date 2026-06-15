import { proxyToMarvinApi, requireApiSession } from "@/lib/marvin-server";

export async function POST() {
  const unauthorized = await requireApiSession();
  if (unauthorized) return unauthorized;
  return proxyToMarvinApi({ path: "/alerts/refresh", method: "POST" });
}
