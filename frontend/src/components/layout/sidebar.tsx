"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  Bell,
  BookOpen,
  Bug,
  FileSearch,
  FlaskConical,
  LayoutDashboard,
  Network,
  ScrollText,
  Search,
  Shield,
  Siren,
  Target,
} from "lucide-react";

interface NavigationItem {
  label: string;
  href: string;
  icon: typeof Activity;
}

const navigation: NavigationItem[] = [
  {
    label: "Overview",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    label: "Alerts",
    href: "/alerts",
    icon: Bell,
  },
  {
    label: "Investigations",
    href: "/investigations",
    icon: Search,
  },
  {
    label: "Detections",
    href: "/detections",
    icon: Target,
  },
  {
    label: "Events",
    href: "/events",
    icon: Activity,
  },
  {
    label: "Scenarios",
    href: "/scenarios",
    icon: FlaskConical,
  },
  {
    label: "Incidents",
    href: "/incidents",
    icon: Siren,
  },
  {
    label: "Evidence",
    href: "/evidence",
    icon: FileSearch,
  },
  {
    label: "MITRE ATT&CK",
    href: "/mitre",
    icon: Network,
  },
  {
    label: "Reports",
    href: "/reports",
    icon: ScrollText,
  },
];

function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <Link href="/" className="brand-mark" aria-label="Security home">
          <span className="brand-icon">
            <Shield size={18} strokeWidth={2} />
          </span>

          <span className="brand-copy">
            <span className="brand-name">Security</span>
            <span className="brand-product">Detection Platform</span>
          </span>
        </Link>
      </div>

      <nav className="sidebar-navigation" aria-label="Primary navigation">
        <div className="navigation-section">
          <span className="navigation-label">Workspace</span>

          <div className="navigation-items">
            {navigation.map((item) => {
              const Icon = item.icon;
              const active = isActivePath(pathname, item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`navigation-item${active ? " active" : ""}`}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon size={16} strokeWidth={1.8} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      <div className="sidebar-footer">
        <div className="environment-status">
          <span className="status-indicator" />
          <span>Local environment</span>
        </div>

        <div className="sidebar-version">
          Security Platform <span>v0.1</span>
        </div>
      </div>
    </aside>
  );
}