"use client";

import FileExplorer, { CloudFile, UIFileItem } from "@/components/ui/file-selectors/FileExplorer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DatabaseIcon, SettingsIcon, Workflow } from "@/components/ui/lucide-shim";
import { cn } from "@/lib/utils";
import { DemoIntegrationItem } from "@/lib/mock/integrations-demo";
import { FileSource } from "@prisma/client";
import { useEffect, useState } from "react";

interface MockCloudNode {
  id: string;
  name: string;
  isDir: boolean;
  /** Shared drives get the database glyph like production Google Drive. */
  sharedDrive?: boolean;
  children?: MockCloudNode[];
}

const CLOUD_SOURCE_BY_DRIVE: Record<string, FileSource> = {
  "google-drive": FileSource.GOOGLE_DRIVE,
  "onedrive-sharepoint": FileSource.MICROSOFT_SHAREPOINT,
  dropbox: FileSource.DROPBOX,
  box: FileSource.BOX,
};

const MOCK_CLOUD_TREES: Record<string, MockCloudNode[]> = {
  "google-drive": [
    {
      id: "gd-cs",
      name: "Customer Success",
      isDir: true,
      sharedDrive: true,
      children: [
        { id: "gd-cs-1", name: "QBR Deck - Meridian Health.pdf", isDir: false },
        { id: "gd-cs-2", name: "Renewal Tracker 2026.xlsx", isDir: false },
      ],
    },
    {
      id: "gd-legal",
      name: "Legal Shared Drive",
      isDir: true,
      sharedDrive: true,
      children: [
        {
          id: "gd-legal-msa",
          name: "MSAs",
          isDir: true,
          children: [
            { id: "gd1", name: "MSA - Meridian Health - Draft v4.docx", isDir: false },
            { id: "gd2", name: "Acme MSA - Indemnification redline.docx", isDir: false },
          ],
        },
        { id: "gd4", name: "Board Consent - Series B.pdf", isDir: false },
        { id: "gd5", name: "DPA Template (EU) v3.docx", isDir: false },
      ],
    },
    {
      id: "gd-vendor",
      name: "Vendor Onboarding",
      isDir: true,
      children: [
        { id: "gd3", name: "Vendor Onboarding Checklist 2026.pdf", isDir: false },
        { id: "gd-vendor-2", name: "Security Questionnaire - Blank.docx", isDir: false },
      ],
    },
    { id: "gd-root-1", name: "Outside Counsel Guidelines.pdf", isDir: false },
  ],
  "onedrive-sharepoint": [
    {
      id: "sp-legal",
      name: "Legal",
      isDir: true,
      children: [
        {
          id: "sp-contracts",
          name: "Contracts",
          isDir: true,
          children: [
            { id: "sp1", name: "SOW - Delta Logistics.docx", isDir: false },
            { id: "sp3", name: "License Agreement - Kite Analytics.pdf", isDir: false },
          ],
        },
        { id: "sp2", name: "Records Retention Policy.pdf", isDir: false },
      ],
    },
    {
      id: "sp-hr",
      name: "HR",
      isDir: true,
      children: [{ id: "sp4", name: "Employment Agreement Template.docx", isDir: false }],
    },
  ],
  dropbox: [
    {
      id: "db-signed",
      name: "Signed",
      isDir: true,
      children: [
        { id: "db1", name: "NDA - Northwind - Executed.pdf", isDir: false },
        { id: "db2", name: "Lease Amendment No. 2.pdf", isDir: false },
      ],
    },
    {
      id: "db-diligence",
      name: "Diligence",
      isDir: true,
      children: [{ id: "db3", name: "Cap Table Snapshot.xlsx", isDir: false }],
    },
  ],
  box: [
    { id: "bx1", name: "Litigation Hold Notice - Case 26-114.pdf", isDir: false },
    { id: "bx2", name: "Settlement Agreement - Draft.docx", isDir: false },
    { id: "bx3", name: "Expert Report - Damages.pdf", isDir: false },
  ],
};

function mimeFor(name: string): string {
  if (name.endsWith(".pdf")) return "application/pdf";
  if (name.endsWith(".xlsx")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
}

function toUIItem(node: MockCloudNode, driveId: string): UIFileItem {
  return {
    id: node.id,
    name: node.name,
    isDir: node.isDir,
    type: node.isDir ? "application/vnd.google-apps.folder" : mimeFor(node.name),
    size: node.isDir ? 0 : 24_000 + node.name.length * 1000,
    cloudSource: CLOUD_SOURCE_BY_DRIVE[driveId] ?? FileSource.GOOGLE_DRIVE,
    icon: node.sharedDrive ? DatabaseIcon : undefined,
  };
}

function findChildren(nodes: MockCloudNode[], parentId?: CloudFile["id"]): MockCloudNode[] | null {
  if (parentId === undefined) return nodes;
  for (const node of nodes) {
    if (node.id === parentId) return node.children ?? [];
    if (node.children) {
      const found = findChildren(node.children, parentId);
      if (found) return found;
    }
  }
  return null;
}

function searchTree(nodes: MockCloudNode[], keywords: string[]): MockCloudNode[] {
  const out: MockCloudNode[] = [];
  const walk = (list: MockCloudNode[]): void => {
    for (const node of list) {
      if (keywords.every((k) => node.name.toLowerCase().includes(k.toLowerCase()))) out.push(node);
      if (node.children) walk(node.children);
    }
  };
  walk(nodes);
  return out;
}

export function AddFromCloudDialog({
  open,
  onOpenChange,
  connectedDrives,
  attachedIds,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectedDrives: DemoIntegrationItem[];
  attachedIds: Set<string>;
  onAdd: (driveName: string, files: { id: string; name: string }[]) => void;
}) {
  const [selectedDriveId, setSelectedDriveId] = useState<string | undefined>(connectedDrives[0]?.id);
  const [value, setValue] = useState<CloudFile[]>([]);

  // Reset per open; keep the drive selection in sync with connections.
  useEffect(() => {
    if (open) setValue([]);
  }, [open]);
  useEffect(() => {
    if (!connectedDrives.some((d) => d.id === selectedDriveId)) {
      setSelectedDriveId(connectedDrives[0]?.id);
    }
  }, [connectedDrives, selectedDriveId]);

  const drive = connectedDrives.find((d) => d.id === selectedDriveId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onOpenAutoFocus={(e) => e.preventDefault()} className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Add from Cloud</DialogTitle>
        </DialogHeader>
        {connectedDrives.length === 0 || !drive ? (
          <Card className="flex flex-col items-center justify-center gap-6 px-4 py-6">
            <div className="flex items-center justify-center rounded-full bg-muted p-2 text-muted-foreground">
              <Workflow className="size-10" />
            </div>
            <p className="text-center">
              <span className="text-2xl font-semibold">You haven&apos;t connected your cloud yet.</span>
              <br />
              <span className="text-2xs text-muted-foreground">Connect your cloud in Ruli app.</span>
            </p>
            <Button
              variant="outline"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                window.open("/assistant/demo/integrations", "_blank");
              }}
            >
              Connect your cloud
            </Button>
          </Card>
        ) : (
          <>
            <div className="flex items-center gap-1">
              {connectedDrives.map((integration) => (
                <div
                  key={integration.id}
                  className={cn(
                    "cursor-pointer rounded-full p-2",
                    selectedDriveId === integration.id ? "shadow" : "grayscale",
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={integration.icon}
                    alt={integration.name}
                    className="icon size-5"
                    onClick={() => {
                      setSelectedDriveId(integration.id);
                      setValue([]);
                    }}
                  />
                </div>
              ))}
              <Button
                variant="outline"
                className="ml-auto gap-2"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  window.open("/assistant/demo/integrations", "_blank");
                }}
              >
                <SettingsIcon className="icon" />
                Integrations
              </Button>
            </div>
            <FileExplorer
              key={drive.id}
              multiple
              getList={async ({ parentId, keywords }) => {
                await new Promise((resolve) => {
                  window.setTimeout(resolve, 250);
                });
                const tree = MOCK_CLOUD_TREES[drive.id] ?? [];
                // FileExplorer's default rootId is "" — treat it as the drive root.
                const nodes =
                  keywords.length > 0
                    ? searchTree(tree, keywords)
                    : parentId
                      ? (findChildren(tree, parentId) ?? [])
                      : tree;
                return {
                  list: nodes.map((node) => {
                    const item = toUIItem(node, drive.id);
                    return attachedIds.has(String(item.id)) && !item.isDir
                      ? { ...item, disabled: "Already added to this chat" }
                      : item;
                  }),
                  done: true,
                  keywords,
                };
              }}
              value={value}
              onChange={setValue}
            />
            <DialogFooter>
              <Button
                disabled={value.length === 0}
                onClick={() => {
                  onAdd(
                    drive.name,
                    value.map((f) => ({ id: String(f.id), name: f.name })),
                  );
                  onOpenChange(false);
                }}
              >
                Confirm
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
