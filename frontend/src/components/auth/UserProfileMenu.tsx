"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getInitials, useAuthSession } from "@/lib/auth";
import { world } from "@/lib/services/repository";

export function UserProfileMenu() {
  const { user, loaded, logout } = useAuthSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Close when clicking outside
  useEffect(() => {
    const handleDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };

    if (menuOpen) {
      document.addEventListener("mousedown", handleDocClick);
      document.addEventListener("keydown", handleKey);
    }
    return () => {
      document.removeEventListener("mousedown", handleDocClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [menuOpen]);

  const handleSignOut = () => {
    logout();
    setMenuOpen(false);
    router.push("/login");
  };

  // Before hydration, render placeholder
  if (!loaded) {
    return (
      <div className="flex h-[32px] w-[32px] items-center justify-center rounded-full bg-ink/10 animate-pulse text-[11px]" />
    );
  }

  // Not logged in: show Sign In button
  if (!user) {
    return (
      <Link
        href="/login"
        className="inline-flex items-center gap-1.5 rounded-full border border-ink/20 px-3.5 py-1 text-[12px] font-medium tracking-wide transition-colors hover:border-ink hover:bg-ink hover:text-ground"
      >
        <span>Sign in</span>
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M6 3 L11 8 L6 13" />
        </svg>
      </Link>
    );
  }

  // Logged in: show active profile avatar & menu
  const initials = getInitials(user.name);

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setMenuOpen((prev) => !prev)}
        aria-expanded={menuOpen}
        aria-haspopup="true"
        aria-label={`Profile menu for ${user.name}`}
        className="group flex items-center gap-2 rounded-full border border-ink/15 bg-ground/80 p-0.5 pr-2.5 transition-all hover:border-gold-deep hover:shadow-xs focus:outline-none focus:ring-2 focus:ring-gold-deep/30"
      >
        <div className="relative flex h-[30px] w-[30px] items-center justify-center rounded-full bg-ink text-[11.5px] font-semibold text-ground shadow-xs transition-transform group-hover:scale-105">
          {initials}
          <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-ground bg-emerald-500" />
        </div>
        <span className="hidden max-w-[110px] truncate text-[12.5px] font-medium text-ink md:inline">
          {user.name.split(" ")[0]}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          className={`text-ink/60 transition-transform duration-200 ${menuOpen ? "rotate-180" : ""}`}
        >
          <path d="M4 6 L8 10 L12 6" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {menuOpen && (
        <div
          role="menu"
          aria-label="User profile options"
          className="absolute right-0 z-50 mt-2.5 w-[280px] origin-top-right rounded-lg border border-ink/15 bg-ground p-1.5 shadow-xl backdrop-blur-md transition-all animate-in fade-in zoom-in-95"
        >
          {/* User details header */}
          <div className="border-b border-rule/70 p-3 pb-3.5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-[13px] font-bold text-ground shadow-inner">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-semibold text-ink">{user.name}</p>
                <p className="truncate text-[11.5px] text-muted">{user.email}</p>
              </div>
            </div>
            <div className="mt-2.5 flex items-center justify-between text-[11px]">
              <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 font-medium text-amber-900 border border-amber-200/60">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-600 animate-pulse" />
                Demand Planner
              </span>
              <span className="text-muted">{world.store}</span>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="py-1">
            <Link
              href="/profile"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] text-ink2 transition-colors hover:bg-ink/5 hover:text-ink"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="8" r="5" />
                <path d="M20 21a8 8 0 1 0-16 0" />
              </svg>
              <span>My Profile & Account</span>
            </Link>

            <Link
              href="/profile#csv-history"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] text-ink2 transition-colors hover:bg-ink/5 hover:text-ink"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              <span>Saved CSV History</span>
            </Link>

            <Link
              href="/ml-forecast"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] text-ink2 transition-colors hover:bg-ink/5 hover:text-ink"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                <polyline points="17 6 23 6 23 12" />
              </svg>
              <span>Forecast Studio</span>
            </Link>
          </div>

          <div className="border-t border-rule/70 pt-1">
            <button
              type="button"
              onClick={handleSignOut}
              className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium text-rose-700 transition-colors hover:bg-rose-50"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
