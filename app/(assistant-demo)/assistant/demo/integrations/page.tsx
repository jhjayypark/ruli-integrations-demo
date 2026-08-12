"use client";

import IntegrationCard from "@/components/settings/integrations/IntegrationCard";
import { ConfirmContent } from "@/components/Confirm";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { Input } from "@/components/ui/input";
import { CheckIcon, ExternalLinkIcon, Search } from "@/components/ui/lucide-shim";
import { useDialogCreation } from "@/lib/hooks/useDialogCreation";
import { useGoogleWorkspaceDemoConnections } from "@/lib/mock/google-workspace-demo";
import {
  DEMO_INTEGRATION_CATEGORIES,
  DemoIntegrationItem,
  useDemoIntegrationConnections,
} from "@/lib/mock/integrations-demo";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";

const CONNECT_DELAY_MS = 1200;

const POPULAR_IDS = ["gmail", "google-drive", "slack"];
const ALL_ITEMS = DEMO_INTEGRATION_CATEGORIES.flatMap((c) => c.items);
const POPULAR_ITEMS = POPULAR_IDS.map((id) => ALL_ITEMS.find((it) => it.id === id)).filter(
  (it): it is DemoIntegrationItem => Boolean(it),
);
const TABS = ["All", ...DEMO_INTEGRATION_CATEGORIES.map((c) => c.category)];

export default function DemoIntegrationsPage() {
  const gw = useGoogleWorkspaceDemoConnections();
  const generic = useDemoIntegrationConnections();
  const [connectingIds, setConnectingIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<string>("All");
  const [query, setQuery] = useState("");
  const [tabsStuck, setTabsStuck] = useState(false);
  const tabsSentinelRef = useRef<HTMLDivElement>(null);
  const [dialogHolder, createDialog] = useDialogCreation();
  const connectTimers = useRef<number[]>([]);

  useEffect(() => {
    const timers = connectTimers.current;
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  // Sentinel just above the sticky bar — once it scrolls out of view the bar is stuck.
  useEffect(() => {
    const el = tabsSentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setTabsStuck(!entry.isIntersecting));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  function isConnected(item: DemoIntegrationItem): boolean {
    return item.googleWorkspaceApp ? gw.connections[item.googleWorkspaceApp] : Boolean(generic.connections[item.id]);
  }

  function handleConnect(item: DemoIntegrationItem): void {
    setConnectingIds((prev) => [...prev, item.id]);
    const timer = window.setTimeout(() => {
      if (item.googleWorkspaceApp) {
        gw.connect(item.googleWorkspaceApp);
      } else {
        generic.connect(item.id);
      }
      setConnectingIds((prev) => prev.filter((it) => it !== item.id));
    }, CONNECT_DELAY_MS);
    connectTimers.current.push(timer);
  }

  function handleDisconnect(item: DemoIntegrationItem): void {
    createDialog({
      render: ({ handleOk, confirmLoading }) => (
        <ConfirmContent
          title={`Are you sure to disconnect ${item.name}?`}
          description={`Disconnecting ${item.name} will stop the assistant from using it in chats.`}
          handleOk={handleOk}
          confirmLoading={confirmLoading}
        />
      ),
      onOk: () => {
        if (item.googleWorkspaceApp) {
          gw.disconnect(item.googleWorkspaceApp);
        } else {
          generic.disconnect(item.id);
        }
      },
    });
  }

  const q = query.trim().toLowerCase();
  const visibleSections = DEMO_INTEGRATION_CATEGORIES.filter(
    (section) => activeTab === "All" || section.category === activeTab,
  )
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !q || item.name.toLowerCase().includes(q)),
    }))
    .filter((section) => section.items.length > 0);
  const showApps = activeTab === "All" && (!q || "word extension".includes(q));

  return (
    <>
      {dialogHolder}
      <div className="flex items-center border-b px-4 py-3">
        <p className="text-muted-foreground">Manage your integrations.</p>
      </div>
      <div className="flex flex-col gap-6 p-4">
        {!q && (
          <div className="flex flex-col gap-3">
            <h2 className="text-muted-foreground">Popular</h2>
            <div className="grid w-full grid-cols-1 gap-4 @md/main:grid-cols-3">
              {POPULAR_ITEMS.map((item) => (
                <div key={item.id} className="flex items-center gap-3 rounded-xl border bg-card p-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.icon} alt="" className="size-6 shrink-0" />
                  <span className="flex-1 truncate font-medium">{item.name}</span>
                  {isConnected(item) ? (
                    <Button size="sm" onClick={() => handleDisconnect(item)}>
                      <CheckIcon className="icon mr-2" />
                      Connected
                    </Button>
                  ) : (
                    <LoadingButton
                      size="sm"
                      variant="outline"
                      loading={connectingIds.includes(item.id)}
                      onClick={() => handleConnect(item)}
                    >
                      Connect
                    </LoadingButton>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div ref={tabsSentinelRef} aria-hidden className="-mb-6 h-px w-full" />
        <div
          className={cn(
            "sticky top-0 z-2 -mx-4 flex flex-wrap items-center gap-1 bg-background px-4 pb-3 pt-6 transition-shadow",
            tabsStuck && "border-b shadow-sm",
          )}
        >
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={cn(
                "rounded-lg px-3 py-1.5 transition-colors",
                activeTab === tab
                  ? "border bg-background font-medium text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab}
            </button>
          ))}
          <div className="relative ml-auto">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search integrations"
              className="h-9 w-64 pl-8"
            />
          </div>
        </div>

        {visibleSections.map((section) => (
          <div key={section.category} className="flex flex-col gap-3">
            <h2 className="font-medium">{section.category}</h2>
            <div className="grid w-full grid-cols-1 gap-4 @md/main:grid-cols-2 @xl/main:grid-cols-3">
              {section.items.map((item) => (
                <IntegrationCard
                  key={item.id}
                  name={item.name}
                  description={item.description}
                  icon={item.icon}
                  isConnected={isConnected(item)}
                  isConnecting={connectingIds.includes(item.id)}
                  onConnect={() => handleConnect(item)}
                  onDisconnect={() => handleDisconnect(item)}
                />
              ))}
            </div>
          </div>
        ))}
        {visibleSections.length === 0 && !showApps && (
          <p className="py-8 text-center text-muted-foreground">No integrations match &ldquo;{query}&rdquo;.</p>
        )}
        {showApps && (
          <div className="flex flex-col gap-3">
            <h2 className="font-medium">Apps</h2>
            <div className="grid w-full grid-cols-1 gap-4 @md/main:grid-cols-2 @xl/main:grid-cols-3">
              <IntegrationCard
                name="Word Extension"
                description="Enhance your legal document review with Ruli Word Extension. (Subscription Required)"
                icon="/logos/logo_word.svg"
                renderButton={() => (
                  <a
                    href="https://appsource.microsoft.com/en-us/product/office/WA200008041"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="outline">
                      <ExternalLinkIcon className="icon mr-2" />
                      Install
                    </Button>
                  </a>
                )}
              />
            </div>
          </div>
        )}
      </div>
    </>
  );
}
