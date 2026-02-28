"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/creators", label: "Creators" },
  { href: "/rules", label: "Rules" },
  { href: "/sync-runs", label: "Sync Runs" },
];

export function AppNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/setup");
    router.refresh();
  }

  return (
    <header className="panel site-head">
      <div>
        <h1 className="site-title">YouTube Smart Playlist Manager</h1>
        <p className="site-subtitle">Keyword-driven playlists for one owner account.</p>
      </div>
      <div className="row">
        <nav className="site-nav">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              style={
                pathname === item.href
                  ? {
                      background: "rgba(196, 93, 50, 0.16)",
                      borderColor: "rgba(196, 93, 50, 0.55)",
                    }
                  : undefined
              }
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <button type="button" className="button button-ghost" onClick={logout} disabled={busy}>
          {busy ? "Signing Out..." : "Sign Out"}
        </button>
      </div>
    </header>
  );
}
