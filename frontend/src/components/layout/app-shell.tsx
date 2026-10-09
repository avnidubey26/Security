"use client";

import { useState } from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);

  return (
    <div className="app-shell">
      <div
        className={`mobile-navigation-overlay${
          mobileNavigationOpen ? " visible" : ""
        }`}
        onClick={() => setMobileNavigationOpen(false)}
        aria-hidden="true"
      />

      <div
        className={`app-sidebar-wrapper${
          mobileNavigationOpen ? " mobile-open" : ""
        }`}
      >
        <Sidebar />
      </div>

      <div className="app-main">
        <Topbar
          onMenuClick={() => setMobileNavigationOpen((current) => !current)}
        />

        <main className="app-content">{children}</main>
      </div>
    </div>
  );
}