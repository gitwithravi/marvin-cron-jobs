import { AppShell } from "@/components/layout/app-shell";
import { requireSession } from "@/lib/server/auth";

export default async function ConsoleLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  return <AppShell username={session.username}>{children}</AppShell>;
}
