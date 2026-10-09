"use client";

import {
  Bell,
  ChevronDown,
  Menu,
  Moon,
  ShieldCheck,
  Sun,
} from "lucide-react";
import { useEffect, useState } from "react";

interface TopbarProps {
  onMenuClick?: () => void;
}

type Theme = "dark" | "light";

export function Topbar({ onMenuClick }: TopbarProps) {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const storedTheme = window.localStorage.getItem("security-theme");

    if (storedTheme === "light" || storedTheme === "dark") {
      setTheme(storedTheme);
      document.documentElement.dataset.theme = storedTheme;
      return;
    }

    document.documentElement.dataset.theme = "dark";
  }, []);

  const toggleTheme = () => {
    const nextTheme: Theme = theme === "dark" ? "light" : "dark";

    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem("security-theme", nextTheme);
  };

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button
          type="button"
          className="mobile-menu-button"
          onClick={onMenuClick}
          aria-label="Open navigation"
        >
          <Menu size={18} />
        </button>

        <div className="topbar-context">
          <ShieldCheck size={16} />
          <span>Security Operations</span>
        </div>
      </div>

      <div className="topbar-right">
        <div className="system-status">
          <span className="status-indicator" />
          <span>API Online</span>
        </div>

        <button
          type="button"
          className="icon-button theme-toggle"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
          title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
        >
          {theme === "dark" ? (
            <Sun size={16} strokeWidth={1.8} />
          ) : (
            <Moon size={16} strokeWidth={1.8} />
          )}
        </button>

        <button
          type="button"
          className="icon-button"
          aria-label="Notifications"
        >
          <Bell size={17} strokeWidth={1.8} />
          <span className="notification-dot" />
        </button>

        <div className="user-menu">
          <div className="user-avatar">SA</div>

          <div className="user-details">
            <span className="user-name">Security Analyst</span>
            <span className="user-role">ANALYST</span>
          </div>

          <ChevronDown size={15} className="user-chevron" />
        </div>
      </div>
    </header>
  );
}