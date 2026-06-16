import { proxyToMarvinApi } from "@/lib/marvin-server";

export async function GET() {
  return proxyToMarvinApi({ path: "/todo-people" });
}

export async function POST(req: Request) {
  return proxyToMarvinApi({ path: "/todo-people", method: "POST", body: await req.json() });
}
