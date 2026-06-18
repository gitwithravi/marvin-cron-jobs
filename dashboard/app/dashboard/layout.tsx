import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { marvinCopy } from "@/lib/marvin-copy";
import { ReminderButton } from "@/components/ReminderButton";
import { consoleRoutes } from "@/lib/console/routes";

export default async function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href={consoleRoutes.overview} className="brand">
          <span>{marvinCopy.productName}</span>
          <small>{marvinCopy.shellSubtitle}</small>
        </Link>
        <nav className="nav-links" aria-label="Dashboard">
          <Link href={consoleRoutes.overview}>Overview</Link>
          <Link href={consoleRoutes.approvals}>Approvals</Link>
          <Link href={consoleRoutes.beszel}>Beszel</Link>
          <Link href={consoleRoutes.teamStatus}>Team Status</Link>
          <Link href={consoleRoutes.support}>Support</Link>
          <Link href={consoleRoutes.reports}>Reports</Link>
          <Link href={consoleRoutes.status}>Status</Link>
          <Link href={consoleRoutes.todos}>Todos</Link>
          <Link href={consoleRoutes.emailCaptures}>Email Captures</Link>
          <Link href={consoleRoutes.invoices}>Invoices</Link>
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
    </div>
  );
}
