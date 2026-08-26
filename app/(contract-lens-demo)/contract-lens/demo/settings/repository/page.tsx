"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LoadingButton } from "@/components/ui/loading-button";
import { Switch } from "@/components/ui/switch";
import { FolderIcon, UploadCloudIcon } from "@/components/ui/lucide-shim";
import { DEMO_INTEGRATION_CATEGORIES, useDemoIntegrationConnections } from "@/lib/mock/integrations-demo";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const CLOUD_DRIVE_IDS = ["google-drive", "onedrive-sharepoint", "dropbox", "box"];

const SYNC_DEFAULTS: Record<string, { folder: string; contracts: number; lastSync: string }> = {
  "google-drive": { folder: "/Legal/Contracts", contracts: 128, lastSync: "2 hours ago" },
  "onedrive-sharepoint": { folder: "/Legal/Executed Agreements", contracts: 86, lastSync: "1 hour ago" },
  dropbox: { folder: "/Signed", contracts: 41, lastSync: "yesterday" },
  box: { folder: "/Contracts", contracts: 17, lastSync: "3 days ago" },
};

const CLOUD_DRIVES = DEMO_INTEGRATION_CATEGORIES.flatMap((c) => c.items).filter((it) =>
  CLOUD_DRIVE_IDS.includes(it.id),
);

export default function RepositorySettingsPage(): React.ReactElement {
  const { connections, connect } = useDemoIntegrationConnections();
  const [connectingIds, setConnectingIds] = useState<string[]>([]);
  const [autoSyncOff, setAutoSyncOff] = useState<Set<string>>(new Set());
  const connectTimers = useRef<number[]>([]);

  useEffect(() => {
    const timers = connectTimers.current;
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  const handleConnect = (id: string): void => {
    setConnectingIds((prev) => [...prev, id]);
    const timer = window.setTimeout(() => {
      connect(id);
      setConnectingIds((prev) => prev.filter((it) => it !== id));
    }, 1200);
    connectTimers.current.push(timer);
  };

  const toggleAutoSync = (id: string, enabled: boolean): void => {
    setAutoSyncOff((prev) => {
      const next = new Set(prev);
      if (enabled) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="flex max-w-3xl flex-col gap-6 p-6">
        <div>
          <h2 className="text-lg font-semibold">Repository</h2>
          <p className="text-2xs text-muted-foreground">
            Choose where Contract Lens pulls contracts from. Synced documents power the Repository, Deviation Analysis,
            and the Dashboard.
          </p>
        </div>

        <section className="flex flex-col gap-3">
          <h3 className="font-medium">Sync from cloud storage</h3>
          <Card className="divide-y p-0">
            {CLOUD_DRIVES.map((drive) => {
              const connected = Boolean(connections[drive.id]);
              const meta = SYNC_DEFAULTS[drive.id];
              const autoSync = !autoSyncOff.has(drive.id);
              return (
                <div key={drive.id} className="flex items-center gap-4 px-4 py-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={drive.icon} alt="" className="size-6 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{drive.name}</div>
                    {connected ? (
                      <div className="flex items-center gap-1 text-2xs text-muted-foreground">
                        <FolderIcon className="size-3 shrink-0" />
                        <span className="truncate">{meta.folder}</span>
                        <span className="shrink-0">
                          · {meta.contracts} contracts · Synced {meta.lastSync}
                        </span>
                      </div>
                    ) : (
                      <div className="text-2xs text-muted-foreground">Not connected</div>
                    )}
                  </div>
                  {connected ? (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground"
                        onClick={() => toast.info(`Demo mode: folder picker for ${drive.name} is disabled.`)}
                      >
                        Change folder
                      </Button>
                      <div className="flex items-center gap-2">
                        <span className="text-2xs text-muted-foreground">Auto-sync</span>
                        <Switch
                          size="sm"
                          checked={autoSync}
                          aria-label={`Auto-sync ${drive.name}`}
                          onCheckedChange={(next) => toggleAutoSync(drive.id, next)}
                        />
                      </div>
                    </>
                  ) : (
                    <LoadingButton
                      size="sm"
                      variant="outline"
                      loading={connectingIds.includes(drive.id)}
                      onClick={() => handleConnect(drive.id)}
                    >
                      Connect
                    </LoadingButton>
                  )}
                </div>
              );
            })}
          </Card>
        </section>

        <section className="flex flex-col gap-3">
          <h3 className="font-medium">Manual upload</h3>
          <button
            type="button"
            className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-8 text-muted-foreground transition-colors hover:bg-muted/50"
            onClick={() => toast.info("Demo mode: uploads are disabled.")}
          >
            <UploadCloudIcon className="size-6" />
            <span>
              Drag and drop contracts here, or <span className="font-medium text-foreground">browse files</span>
            </span>
            <span className="text-2xs">PDF and DOCX, up to 25MB each</span>
          </button>
        </section>
      </div>
    </div>
  );
}
