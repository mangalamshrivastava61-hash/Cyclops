"use client";

import { useEffect, useState } from "react";

export const SESSION_KEY = "oracle-demo-session";

export interface UserSession {
  id: number;
  name: string;
  email: string;
  created_at?: string;
}

export function getUserSession(): UserSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as UserSession;
  } catch {
    return null;
  }
}

export function setUserSession(user: UserSession): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  window.dispatchEvent(new Event("oracle-auth-change"));
}

export function clearUserSession(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SESSION_KEY);
  window.dispatchEvent(new Event("oracle-auth-change"));
}

export function getInitials(name: string): string {
  if (!name) return "OR";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Hook to reactively subscribe to the active user session */
export function useAuthSession() {
  const [user, setUser] = useState<UserSession | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const sync = () => {
      setUser(getUserSession());
      setLoaded(true);
    };

    sync();

    const handleCustom = () => sync();
    const handleStorage = (e: StorageEvent) => {
      if (e.key === SESSION_KEY || !e.key) sync();
    };

    window.addEventListener("oracle-auth-change", handleCustom);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("oracle-auth-change", handleCustom);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const logout = () => {
    clearUserSession();
    setUser(null);
  };

  return { user, loaded, logout };
}
