import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { marvinCopy } from "@/lib/marvin-copy";
import { ChatWidget } from "@/components/ChatWidget";
import { ReminderButton } from "@/components/ReminderButton";

export default async function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/dashboard" className="brand">
          <span>{marvinCopy.productName}</span>
          <small>{marvinCopy.shellSubtitle}</small>
        </Link>
        <nav className="nav-links" aria-label="Dashboard">
          <Link href="/dashboard">Overview</Link>
          <Link href="/dashboard/team-status">Team Status</Link>
          <Link href="/dashboard/reports">Reports</Link>
          <Link href="/dashboard/todos">Todos</Link>
        </nav>
        <div className="sidebar-footer">
          <p>{session.username}</p>
          <form action="/api/logout" method="post">
            <button type="submit" className="text-button">
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <main className="main-content">
        <div className="dashboard-topbar">
          <ReminderButton />
        </div>
        {children}
      </main>
      <ChatWidget />
    </div>
  );
}
