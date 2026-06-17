import { requireSession } from "@/lib/auth";
import { Sidebar } from "@/components/shell/Sidebar";

export default async function ConsoleLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();

  return (
    <div className="app-shell">
      <Sidebar username={session.username} />
      <main className="main-content">{children}</main>
    </div>
  );
}
