"use client";

import { useCallback, useEffect, useState } from "react";

export type GoogleWorkspaceDemoApp = "gmail" | "googleCalendar";

export interface GoogleWorkspaceDemoConnections {
  gmail: boolean;
  googleCalendar: boolean;
}

export interface GoogleWorkspaceDemoAppConfig {
  app: GoogleWorkspaceDemoApp;
  name: string;
  logo: string;
  description: string;
}

export const GOOGLE_WORKSPACE_DEMO_APPS: GoogleWorkspaceDemoAppConfig[] = [
  {
    app: "gmail",
    name: "Gmail",
    logo: "/logos/logo_gmail.svg",
    description: "Allow Ruli to search and reference Gmail threads. Tools: Search Threads, Get Thread.",
  },
  {
    app: "googleCalendar",
    name: "Google Calendar",
    logo: "/logos/logo_googlecalendar.svg",
    description: "Allow Ruli to search and reference calendar events. Tools: Search Events, Get Event Details.",
  },
];

const STORAGE_KEY = "ruli-demo-google-workspace";
const CHANGE_EVENT = "ruli-demo-google-workspace-change";

const DEFAULT_CONNECTIONS: GoogleWorkspaceDemoConnections = { gmail: false, googleCalendar: false };

// In-memory fallback so the demo keeps working when localStorage is unavailable (SSR, incognito).
let memoryConnections: GoogleWorkspaceDemoConnections = DEFAULT_CONNECTIONS;

function readConnections(): GoogleWorkspaceDemoConnections {
  if (typeof window === "undefined") return DEFAULT_CONNECTIONS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return memoryConnections;
    const parsed = JSON.parse(raw) as Partial<GoogleWorkspaceDemoConnections>;
    return { gmail: Boolean(parsed.gmail), googleCalendar: Boolean(parsed.googleCalendar) };
  } catch {
    return memoryConnections;
  }
}

function writeConnections(next: GoogleWorkspaceDemoConnections): void {
  memoryConnections = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable — memoryConnections keeps same-tab state alive.
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

export interface UseGoogleWorkspaceDemoConnectionsResult {
  connections: GoogleWorkspaceDemoConnections;
  connect: (app: GoogleWorkspaceDemoApp) => void;
  disconnect: (app: GoogleWorkspaceDemoApp) => void;
}

export function useGoogleWorkspaceDemoConnections(): UseGoogleWorkspaceDemoConnectionsResult {
  const [connections, setConnections] = useState<GoogleWorkspaceDemoConnections>(DEFAULT_CONNECTIONS);

  useEffect(() => {
    const sync = (): void => setConnections(readConnections());
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener(CHANGE_EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(CHANGE_EVENT, sync);
    };
  }, []);

  const connect = useCallback((app: GoogleWorkspaceDemoApp): void => {
    writeConnections({ ...readConnections(), [app]: true });
  }, []);

  const disconnect = useCallback((app: GoogleWorkspaceDemoApp): void => {
    writeConnections({ ...readConnections(), [app]: false });
  }, []);

  return { connections, connect, disconnect };
}
