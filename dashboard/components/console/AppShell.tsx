"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReminderButton } from "@/components/ReminderButton";
import { marvinCopy } from "@/lib/marvin-copy";
import { consoleRoutes } from "@/lib/console/routes";

const navItems = [
  { href: consoleRoutes.overview, label: "Command" },
  { href: consoleRoutes.approvals, label: "Approvals" },
  { href: consoleRoutes.reports, label: "Reports" },
  { href: consoleRoutes.beszel, label: "Infrastructure" },
  { href: consoleRoutes.teamStatus, label: "Humans" },
  { href: consoleRoutes.todos, label: "Todos" },
  { href: consoleRoutes.support, label: "Support" },
  { href: consoleRoutes.emailCaptures, label: "Email" },
  { href: consoleRoutes.invoices, label: "Invoices" },
  { href: consoleRoutes.status, label: "Status" }
];

function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({
  username,
  children
}: {
  username: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="console-shell">
      <aside className="console-sidebar">
        <Link href={consoleRoutes.overview} className="console-brand">
          <span>{marvinCopy.productName}</span>
          <small>Command Center, not admin panel</small>
        </Link>
        <nav className="console-nav" aria-label="Console">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={isActivePath(pathname, item.href) ? "active" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="console-sidebar-footer">
          <p>{username}</p>
          <form action="/api/logout" method="post">
            <button type="submit" className="text-button">
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <main className="console-main">
        <div className="console-topbar">
          <div>
            <p className="console-topbar-label">Quiet command center</p>
            <p className="console-topbar-copy">
              What broke, what MARVIN concluded, and which human decision is still required.
            </p>
          </div>
          <ReminderButton />
        </div>
        <div className="console-content">{children}</div>
      </main>
    </div>
  );
}
