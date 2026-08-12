"use client";

import { useCallback, useEffect, useState } from "react";
import { GoogleWorkspaceDemoApp } from "@/lib/mock/google-workspace-demo";

export interface DemoIntegrationItem {
  id: string;
  name: string;
  description: string;
  icon: string;
  /** Wired to the Google Workspace store so the chat source toggles stay in sync. */
  googleWorkspaceApp?: GoogleWorkspaceDemoApp;
  /** Pre-connected in the demo (existing Ruli integrations per the connector matrix). */
  defaultConnected?: boolean;
}

export interface DemoIntegrationCategory {
  category: string;
  items: DemoIntegrationItem[];
}

export const DEMO_INTEGRATION_CATEGORIES: DemoIntegrationCategory[] = [
  {
    category: "Comms",
    items: [
      {
        id: "gmail",
        name: "Gmail",
        description: "Allow Ruli to search and reference Gmail threads. Tools: Search Threads, Get Thread.",
        icon: "/logos/logo_gmail.svg",
        googleWorkspaceApp: "gmail",
      },
      {
        id: "google-calendar",
        name: "Google Calendar",
        description: "Allow Ruli to search and reference calendar events. Tools: Search Events, Get Event Details.",
        icon: "/logos/logo_googlecalendar.svg",
        googleWorkspaceApp: "googleCalendar",
      },
      {
        id: "google-drive",
        name: "Google Drive",
        description: "Search and list Drive files and folders, fetch file metadata, and browse shared drives.",
        icon: "/logos/logo_googledrive.svg",
        defaultConnected: true,
      },
      {
        id: "outlook",
        name: "Outlook",
        description: "Fetch and sync emails, folders, calendar events, and calendars.",
        icon: "/logos/logo_outlook.svg",
      },
      {
        id: "onedrive-sharepoint",
        name: "OneDrive / SharePoint",
        description: "List drives and folders, fetch file and folder metadata, and list permissions.",
        icon: "/logos/logo_sharepoint.svg",
        defaultConnected: true,
      },
      {
        id: "ms-teams",
        name: "Microsoft Teams",
        description: "Search messages, fetch channel history and thread replies, and list channels and files.",
        icon: "/logos/logo_teams.svg",
      },
      {
        id: "slack",
        name: "Slack",
        description: "Search messages, fetch channel history and thread replies, and list channels and files.",
        icon: "/logos/logo_slack.svg",
        defaultConnected: true,
      },
    ],
  },
  {
    category: "Sales",
    items: [
      {
        id: "hubspot",
        name: "HubSpot",
        description: "Search companies, contacts, deals, and tickets; fetch record and pipeline details.",
        icon: "/logos/logo_hubspot.svg",
      },
      {
        id: "salesforce",
        name: "Salesforce",
        description: "Search CRM records — contracts and deal terms most relevant for legal.",
        icon: "/logos/logo_salesforce.svg",
      },
    ],
  },
  {
    category: "Ticketing",
    items: [
      {
        id: "asana",
        name: "Asana",
        description: "Review legal service requests tracked in Asana.",
        icon: "/logos/logo_asana.svg",
      },
      {
        id: "jira",
        name: "Jira",
        description: "Review legal service requests tracked in Jira.",
        icon: "/logos/logo_jira.svg",
      },
      {
        id: "trello",
        name: "Trello",
        description: "Review boards and cards used for legal workflows.",
        icon: "/logos/logo_trello.svg",
      },
      {
        id: "zendesk",
        name: "Zendesk",
        description: "Review legal service requests raised through support tickets.",
        icon: "/logos/logo_zendesk.svg",
      },
      {
        id: "servicenow",
        name: "ServiceNow",
        description: "Review legal service requests raised in ServiceNow.",
        icon: "/logos/logo_servicenow.png",
      },
      {
        id: "freshworks",
        name: "Freshworks",
        description: "Review support tickets and service requests.",
        icon: "/logos/logo_freshworks.png",
      },
    ],
  },
  {
    category: "Knowledge",
    items: [
      {
        id: "airtable",
        name: "Airtable",
        description: "Pull spreadsheet data into DataGrid.",
        icon: "/logos/logo_airtable.svg",
      },
      {
        id: "notion",
        name: "Notion",
        description: "Pull matter and knowledge page data.",
        icon: "/logos/logo_notion.svg",
      },
      {
        id: "glean",
        name: "Glean",
        description: "Search your company knowledge across connected apps.",
        icon: "/logos/logo_glean.png",
      },
      {
        id: "dropbox",
        name: "Dropbox",
        description: "Access your Dropbox files and folders.",
        icon: "/logos/logo_dropbox.svg",
        defaultConnected: true,
      },
      {
        id: "box",
        name: "Box",
        description: "Access your Box files and folders.",
        icon: "/logos/logo_box.svg",
        defaultConnected: true,
      },
      {
        id: "confluence",
        name: "Confluence",
        description: "Access your Confluence spaces and pages.",
        icon: "/logos/logo_confluence.svg",
        defaultConnected: true,
      },
      {
        id: "snowflake",
        name: "Snowflake",
        description: "Query warehouse data for analysis.",
        icon: "/logos/logo_snowflake.svg",
      },
    ],
  },
  {
    category: "Corporate",
    items: [
      {
        id: "sap",
        name: "SAP",
        description: "Pull spend data for eBilling analysis.",
        icon: "/logos/logo_sap.svg",
      },
      {
        id: "workday",
        name: "Workday",
        description: "Pull HR data.",
        icon: "/logos/logo_workday.png",
      },
    ],
  },
  {
    category: "Legal",
    items: [
      {
        id: "docusign",
        name: "Docusign",
        description: "Access executed agreements and envelope status.",
        icon: "/logos/logo_docusign.png",
      },
      {
        id: "ironclad",
        name: "Ironclad",
        description: "Access contract workflows and repository records.",
        icon: "/logos/logo_ironclad.png",
      },
      {
        id: "legal-tracker",
        name: "Thomson Reuters Legal Tracker",
        description: "Pull legal spend data.",
        icon: "/logos/logo_thomsonreuters.png",
      },
      {
        id: "pandadoc",
        name: "PandaDoc",
        description: "Pull contract data.",
        icon: "/logos/logo_pandadoc.png",
      },
      {
        id: "coupa",
        name: "Coupa",
        description: "Pull spend data for eBilling analysis.",
        icon: "/logos/logo_coupa.png",
      },
    ],
  },
];

const STORAGE_KEY = "ruli-demo-integrations";
const CHANGE_EVENT = "ruli-demo-integrations-change";

type ConnectionMap = Record<string, boolean>;

const DEFAULT_CONNECTIONS: ConnectionMap = Object.fromEntries(
  DEMO_INTEGRATION_CATEGORIES.flatMap((c) =>
    c.items.filter((it) => !it.googleWorkspaceApp).map((it) => [it.id, Boolean(it.defaultConnected)]),
  ),
);

// In-memory fallback so the demo keeps working when localStorage is unavailable (SSR, incognito).
let memoryConnections: ConnectionMap = DEFAULT_CONNECTIONS;

function readConnections(): ConnectionMap {
  if (typeof window === "undefined") return DEFAULT_CONNECTIONS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return memoryConnections;
    const parsed = JSON.parse(raw) as ConnectionMap;
    return { ...DEFAULT_CONNECTIONS, ...parsed };
  } catch {
    return memoryConnections;
  }
}

function writeConnections(next: ConnectionMap): void {
  memoryConnections = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable — memoryConnections keeps same-tab state alive.
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

export interface UseDemoIntegrationConnectionsResult {
  connections: ConnectionMap;
  connect: (id: string) => void;
  disconnect: (id: string) => void;
}

export function useDemoIntegrationConnections(): UseDemoIntegrationConnectionsResult {
  const [connections, setConnections] = useState<ConnectionMap>(DEFAULT_CONNECTIONS);

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

  const connect = useCallback((id: string): void => {
    writeConnections({ ...readConnections(), [id]: true });
  }, []);

  const disconnect = useCallback((id: string): void => {
    writeConnections({ ...readConnections(), [id]: false });
  }, []);

  return { connections, connect, disconnect };
}
