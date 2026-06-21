import { redirect } from "next/navigation";
import { getSession } from "@/lib/server/auth";

export default async function HomePage() {
  const session = await getSession();
  redirect(session ? "/console" : "/login");
}
