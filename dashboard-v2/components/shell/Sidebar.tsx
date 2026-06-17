"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  AlertCircle,
  Activity,
  CheckSquare,
  Briefcase,
  Server,
  HelpCircle,
  DollarSign,
  MessageSquare
} from "lucide-react";
import { marvinCopy } from "@/lib/marvin-copy";

const navItems = [
  { href: "/console", label: "Command", icon: LayoutDashboard },
  { href: "/console/attention", label: "Attention", icon: AlertCircle },
  { href: "/console/runs", label: "Runs", icon: Activity },
  { href: "/console/approvals", label: "Approvals", icon: CheckSquare },
  { href: "/console/work", label: "Work", icon: Briefcase },
  { href: "/console/systems", label: "Systems", icon: Server },
  { href: "/console/support", label: "Support", icon: HelpCircle },
  { href: "/console/finance", label: "Finance", icon: DollarSign },
  { href: "/console/chat", label: "Chat", icon: MessageSquare }
];

type SidebarProps = {
  username: string;
};

export function Sidebar({ username }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <Link href="/console" className="brand">
        <span>{marvinCopy.productName}</span>
        <small>{marvinCopy.shellSubtitle}</small>
      </Link>
      <nav>
        {navItems.map((item) => {
          const isActive =
            item.href === "/console"
              ? pathname === "/console"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={isActive ? "active" : ""}
              style={{ display: "flex", alignItems: "center", gap: "10px" }}
            >
              <Icon size={16} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="sidebar-footer">
        <p>{username}</p>
        <form action="/api/logout" method="post">
          <button type="submit" className="text-button">
            Sign out
          </button>
        </form>
        <p className="env-label">{marvinCopy.environmentLabel}</p>
      </div>
    </aside>
  );
}
