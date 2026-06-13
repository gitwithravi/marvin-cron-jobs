import Link from "next/link";
import { requireSession } from "@/lib/auth";

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
          <span>MARVIN</span>
          <small>Agent Dashboard</small>
        </Link>
        <nav className="nav-links" aria-label="Dashboard">
          <Link href="/dashboard">Overview</Link>
          <Link href="/dashboard/reports">Reports</Link>
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
      <main className="main-content">{children}</main>
    </div>
  );
}
