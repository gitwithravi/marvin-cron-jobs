"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { consoleRoutes } from "@/lib/routes";
import { marvinCopy } from "@/lib/marvin-copy";

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

function SidebarNav({ pathname, username }: { pathname: string; username: string }) {
  return (
    <div className="flex h-full flex-col gap-6">
      <Link href={consoleRoutes.overview} className="space-y-2 rounded-xl border border-sidebar-border/80 bg-sidebar-accent/70 p-4">
        <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-primary/90">
          Local Ops / Single Operator
        </div>
        <div>
          <div className="text-xl font-medium text-sidebar-foreground">{marvinCopy.consoleName}</div>
          <p className="mt-1 text-sm leading-6 text-sidebar-foreground/70">
            Command center, not admin panel.
          </p>
        </div>
      </Link>
      <nav className="grid gap-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-lg px-3 py-2 text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
              isActivePath(pathname, item.href) && "bg-sidebar-accent text-sidebar-foreground"
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="mt-auto rounded-xl border border-sidebar-border/80 bg-sidebar-accent/40 p-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Signed in
        </p>
        <p className="mt-1 text-sm text-sidebar-foreground">{username}</p>
        <form action="/api/logout" method="post" className="mt-4">
          <Button type="submit" variant="outline" size="sm" className="w-full justify-center">
            Sign out
          </Button>
        </form>
      </div>
    </div>
  );
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
    <div className="min-h-screen bg-transparent">
      <div className="mx-auto grid min-h-screen max-w-[1680px] grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="hidden border-r border-sidebar-border/70 bg-sidebar/90 px-5 py-6 backdrop-blur lg:block">
          <SidebarNav pathname={pathname} username={username} />
        </aside>
        <div className="flex min-h-screen flex-col">
          <header className="sticky top-0 z-20 border-b border-border/70 bg-background/80 px-4 py-3 backdrop-blur md:px-6 lg:px-8">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-primary/90">
                  Quiet command center
                </p>
                <p className="text-sm text-muted-foreground">
                  What broke, what MARVIN concluded, and which human decision is still required.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="icon" className="lg:hidden">
                      <Menu className="size-4" />
                      <span className="sr-only">Open navigation</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="left-auto right-0 top-0 h-screen w-[min(86vw,22rem)] translate-x-0 translate-y-0 rounded-none border-l border-border/80">
                    <DialogTitle className="sr-only">Navigation</DialogTitle>
                    <SidebarNav pathname={pathname} username={username} />
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </header>
          <main className="flex-1 px-4 py-6 md:px-6 lg:px-8">
            <div className="mx-auto flex max-w-7xl flex-col gap-6">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
