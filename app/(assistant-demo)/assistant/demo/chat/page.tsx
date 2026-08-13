"use client";

import { ChatMessage } from "@/components/copilot/ChatMessage/ChatMessage";
import { useCopilotContext } from "@/components/copilot/context";
import { useLayout } from "@/components/layout/context";
import { HighlightedInput } from "@/components/HighlightedInput";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { IconFile } from "@/components/ui/icons";
import TextAutoEllipsis from "@/components/TextAutoEllipsis";
import { StatuteCitation } from "@/lib/json-types";
import {
  MOCK_UNIFIED_CHAT_MESSAGES,
  MOCK_CLAUSE_CONVERSATIONS,
  UK_PRIMARY_LEGISLATION,
  UK_PRIMARY_KEY,
  UK_SECONDARY_LEGISLATION,
  UK_SECONDARY_KEY,
  EU_PRIMARY_LEGISLATION,
  EU_PRIMARY_KEY,
  EU_SECONDARY_LEGISLATION,
  EU_SECONDARY_KEY,
} from "@/lib/mock/assistant-demo-data";
import {
  Federal_Statutes,
  Federal_Statutes_KEY,
  States_Statutes,
  States_Statutes_KEY,
  US_STATES,
  US_STATES_KEY,
} from "@/app/api/copilot-chat/constants";
import { Input } from "@/components/ui/input";
import { parseMessage } from "@/components/copilot/ChatMessage/message-parser";
import type { StreamingChatData } from "@/lib/stream";
import { ChatMessageGPTRole } from "@prisma/client";
import {
  ArrowUp,
  BookIcon,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  DatabaseIcon,
  FolderIcon,
  FolderPlus,
  GlobeIcon,
  Lock,
  MicIcon,
  PaperclipIcon,
  PlusIcon,
  RefreshCw,
  Search,
  SparklesIcon,
  Table2Icon,
  TrashIcon,
  UploadCloudIcon,
  WorkflowIcon,
  XIcon,
} from "@/components/ui/lucide-shim";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { AddFromCloudDialog } from "./AddFromCloudDialog";
import { useGoogleWorkspaceDemoConnections } from "@/lib/mock/google-workspace-demo";
import {
  DEMO_INTEGRATION_CATEGORIES,
  DemoIntegrationItem,
  useDemoIntegrationConnections,
} from "@/lib/mock/integrations-demo";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { PageActions } from "@/components/layout/slots/PageActions";
import { AddToProjectDialog, type AddToProjectPayload } from "@/components/project2/AddToProjectDialog";
import type { Conversation as ProjectConversation } from "@/lib/mock/project2-demo-data";

// ---------------------------------------------------------------------------
// Country sources list (v3: full country names, nucleo-flags icons)
// ---------------------------------------------------------------------------
import { IconUnitedStates, IconUnitedKingdom, IconEurope } from "nucleo-flags";

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------
const messages = MOCK_UNIFIED_CHAT_MESSAGES.map((m) => ({
  ...m,
  role: m.role as ChatMessageGPTRole,
})) as StreamingChatData[];

interface MockFile {
  id: string;
  name: string;
}

const MOCK_FILE_POOL: MockFile[] = [
  { id: "f1", name: "Copy of Ruli AI Office Hours (Opt) - VSCO - 2025_05_07 15_00 CDT - Notes by Gemini.pdf" },
  { id: "f2", name: "MSA - Acme Corp - 2025.docx" },
  { id: "f3", name: "NDA - Client B - Executed.pdf" },
  { id: "f4", name: "Q1 2025 Compliance Report.xlsx" },
];

// Cloud-drive integrations that support picking files into the chat.
const CLOUD_DRIVE_IDS = ["google-drive", "onedrive-sharepoint", "dropbox", "box"];

// ---------------------------------------------------------------------------
// Citations initializer (same as v1)
// ---------------------------------------------------------------------------
function CitationsInitializer({ msgs }: { msgs: StreamingChatData[] }) {
  const { setCitations, setStatuteCitations, setCitationOpen } = useCopilotContext();
  const { setRightSidebarOpen } = useLayout();

  useEffect(() => {
    const lastAssistant = [...msgs].reverse().find((m) => m.role === "assistant");
    if (!lastAssistant) {
      setCitations([]);
      setStatuteCitations([]);
      return;
    }
    const parsed = parseMessage(lastAssistant);
    setCitations(parsed.usedNonStatuteCitations);
    setStatuteCitations((parsed.statuteCitations ?? []) as StatuteCitation[]);
  }, [msgs, setCitations, setStatuteCitations, setCitationOpen, setRightSidebarOpen]);

  return null;
}

const COUNTRY_SOURCES = [
  { id: "us", label: "United States", Icon: IconUnitedStates },
  { id: "uk", label: "United Kingdom", Icon: IconUnitedKingdom },
  { id: "eu", label: "European Union", Icon: IconEurope },
];

// ---------------------------------------------------------------------------
// V3 source state types (same as v1)
// ---------------------------------------------------------------------------
interface USSourceState {
  enabled: boolean;
  federal: boolean;
  federalTypes: Federal_Statutes_KEY[];
  stateCodes: US_STATES_KEY[];
  stateTypes: States_Statutes_KEY[];
}
interface UKSourceState {
  enabled: boolean;
  primary: boolean;
  primaryTypes: UK_PRIMARY_KEY[];
  secondary: boolean;
  secondaryTypes: UK_SECONDARY_KEY[];
}
interface EUSourceState {
  enabled: boolean;
  primary: boolean;
  primaryTypes: EU_PRIMARY_KEY[];
  secondary: boolean;
  secondaryTypes: EU_SECONDARY_KEY[];
}

const StatesOptions = Object.entries(US_STATES).map(([code, name]) => ({
  value: code as US_STATES_KEY,
  label: name,
}));

// Dummy detail options for non-US/UK/EU countries
const DUMMY_COUNTRY_DETAILS: Record<string, Record<string, Record<string, string>>> = {
  au: {
    "Federal Legislation": { AU_ACTS: "Commonwealth Acts", AU_REGS: "Commonwealth Regulations" },
    "State Legislation": { AU_STATE_ACTS: "State & Territory Acts", AU_STATE_REGS: "State & Territory Regulations" },
  },
  at: {
    "Federal Law": { AT_FEDERAL: "Federal Law Gazette", AT_CONST: "Constitutional Law" },
    "State Law": { AT_STATE: "Provincial Law Gazettes" },
  },
  be: {
    "Federal Legislation": { BE_LAWS: "Belgian Laws", BE_ROYAL: "Royal Decrees" },
    "Regional Legislation": { BE_FLEMISH: "Flemish Decrees", BE_WALLOON: "Walloon Decrees" },
  },
  br: {
    "Federal Legislation": { BR_CONST: "Federal Constitution", BR_LAWS: "Federal Laws" },
    Regulatory: { BR_DECREES: "Decrees", BR_NORMS: "Normative Instructions" },
  },
  ca: {
    "Federal Legislation": { CA_ACTS: "Federal Acts", CA_REGS: "Federal Regulations" },
    "Provincial Legislation": { CA_PROV_ACTS: "Provincial Acts", CA_PROV_REGS: "Provincial Regulations" },
  },
  fr: {
    "Primary Legislation": { FR_CODES: "Codes", FR_LAWS: "Laws (Lois)" },
    "Secondary Legislation": { FR_DECREES: "Decrees (Décrets)", FR_ORDERS: "Orders (Arrêtés)" },
  },
  de: {
    "Federal Legislation": {
      DE_FEDERAL: "Federal Laws (Bundesgesetze)",
      DE_REGS: "Federal Regulations (Verordnungen)",
    },
    "State Legislation": { DE_STATE: "State Laws (Landesgesetze)" },
  },
  in: {
    "Central Legislation": { IN_ACTS: "Acts of Parliament", IN_ORDINANCES: "Ordinances" },
    Regulatory: { IN_RULES: "Rules & Regulations", IN_NOTIFICATIONS: "Notifications" },
  },
  ie: {
    "Primary Legislation": { IE_ACTS: "Acts of the Oireachtas", IE_CONST: "Constitution" },
    "Secondary Legislation": { IE_SI: "Statutory Instruments" },
  },
  jp: {
    "Primary Legislation": { JP_ACTS: "Acts (法律)", JP_CONST: "Constitution (憲法)" },
    "Secondary Legislation": { JP_CABINET: "Cabinet Orders (政令)", JP_MINISTERIAL: "Ministerial Orders (省令)" },
  },
  nl: {
    "Primary Legislation": { NL_ACTS: "Acts of Parliament", NL_CONST: "Constitution" },
    "Secondary Legislation": { NL_ROYAL: "Royal Decrees", NL_MINISTERIAL: "Ministerial Regulations" },
  },
  nz: {
    "Primary Legislation": { NZ_ACTS: "Acts of Parliament", NZ_CONST: "Constitutional Acts" },
    "Secondary Legislation": { NZ_REGS: "Regulations", NZ_ORDERS: "Orders in Council" },
  },
  sg: {
    "Primary Legislation": { SG_ACTS: "Acts of Parliament", SG_CONST: "Constitution" },
    "Secondary Legislation": { SG_SUBSIDIARY: "Subsidiary Legislation" },
  },
  kr: {
    "Primary Legislation": { KR_ACTS: "Acts (법률)", KR_CONST: "Constitution (헌법)" },
    "Secondary Legislation": {
      KR_PRESIDENTIAL: "Presidential Decrees (대통령령)",
      KR_MINISTERIAL: "Ministerial Ordinances (부령)",
    },
  },
  ch: {
    "Federal Legislation": { CH_FEDERAL: "Federal Acts", CH_CONST: "Federal Constitution" },
    "Cantonal Legislation": { CH_CANTONAL: "Cantonal Laws", CH_ORDINANCES: "Federal Ordinances" },
  },
  ae: {
    "Federal Legislation": { AE_FEDERAL: "Federal Laws", AE_DECREES: "Federal Decrees" },
    "Emirate Legislation": { AE_LOCAL: "Local Laws & Orders" },
  },
};

// ---------------------------------------------------------------------------
// V3 Legal Database Dialog — exact v1 LegalDatabasePanelInner pattern
// Left: country checkboxes with US/UK/EU sub-categories
// Right: detail checkboxes (Federal/State, Primary/Secondary legislation)
// ---------------------------------------------------------------------------
function V3LegalDatabaseDialog({
  open,
  onOpenChange,
  selectedSources,
  onToggleSource,
  mode = "add",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedSources: Set<string>;
  onToggleSource: (id: string) => void;
  mode?: "add" | "edit";
}) {
  const [activeCountry, setActiveCountry] = useState<string | null>(null);
  const [statesExpanded, setStatesExpanded] = useState(false);
  const [stateSearch, setStateSearch] = useState("");
  const [initialSources, setInitialSources] = useState<Set<string>>(new Set());
  // Capture initial state when dialog opens
  useEffect(() => {
    if (open) setInitialSources(new Set(selectedSources));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const hasChanges = (() => {
    if (initialSources.size !== selectedSources.size) return true;
    for (const id of selectedSources) {
      if (!initialSources.has(id)) return true;
    }
    return false;
  })();

  // US/UK/EU detail state — start unchecked, auto-fill when checkbox is checked
  const [us, setUS] = useState<USSourceState>({
    enabled: false,
    federal: false,
    federalTypes: [],
    stateCodes: [],
    stateTypes: [],
  });
  const [uk, setUK] = useState<UKSourceState>({
    enabled: false,
    primary: false,
    primaryTypes: [],
    secondary: false,
    secondaryTypes: [],
  });
  const [eu, setEU] = useState<EUSourceState>({
    enabled: false,
    primary: false,
    primaryTypes: [],
    secondary: false,
    secondaryTypes: [],
  });

  // Dummy country sub-category and detail tracking — start empty
  const [dummySubs, setDummySubs] = useState<Record<string, Set<string>>>({});
  const [dummyDetails, setDummyDetails] = useState<Record<string, Set<string>>>({});

  // Sync US/UK/EU enabled state with selectedSources — auto-fill on first check
  const prevUSEnabled = useRef(false);
  const prevUKEnabled = useRef(false);
  const prevEUEnabled = useRef(false);
  useEffect(() => {
    const usNow = selectedSources.has("us");
    const ukNow = selectedSources.has("uk");
    const euNow = selectedSources.has("eu");
    if (usNow && !prevUSEnabled.current) {
      setUS({
        enabled: true,
        federal: true,
        federalTypes: Object.keys(Federal_Statutes) as Federal_Statutes_KEY[],
        stateCodes: StatesOptions.map(({ value }) => value),
        stateTypes: Object.keys(States_Statutes) as States_Statutes_KEY[],
      });
    } else if (!usNow && prevUSEnabled.current) {
      setUS({ enabled: false, federal: false, federalTypes: [], stateCodes: [], stateTypes: [] });
    } else {
      setUS((prev) => ({ ...prev, enabled: usNow }));
    }
    if (ukNow && !prevUKEnabled.current) {
      setUK({
        enabled: true,
        primary: true,
        primaryTypes: Object.keys(UK_PRIMARY_LEGISLATION) as UK_PRIMARY_KEY[],
        secondary: true,
        secondaryTypes: Object.keys(UK_SECONDARY_LEGISLATION) as UK_SECONDARY_KEY[],
      });
    } else if (!ukNow && prevUKEnabled.current) {
      setUK({ enabled: false, primary: false, primaryTypes: [], secondary: false, secondaryTypes: [] });
    } else {
      setUK((prev) => ({ ...prev, enabled: ukNow }));
    }
    if (euNow && !prevEUEnabled.current) {
      setEU({
        enabled: true,
        primary: true,
        primaryTypes: Object.keys(EU_PRIMARY_LEGISLATION) as EU_PRIMARY_KEY[],
        secondary: true,
        secondaryTypes: Object.keys(EU_SECONDARY_LEGISLATION) as EU_SECONDARY_KEY[],
      });
    } else if (!euNow && prevEUEnabled.current) {
      setEU({ enabled: false, primary: false, primaryTypes: [], secondary: false, secondaryTypes: [] });
    } else {
      setEU((prev) => ({ ...prev, enabled: euNow }));
    }
    prevUSEnabled.current = usNow;
    prevUKEnabled.current = ukNow;
    prevEUEnabled.current = euNow;
  }, [selectedSources]);

  // Auto-enable all subs+details when a dummy country is first checked
  const prevSelectedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const dummyIds = Object.keys(DUMMY_COUNTRY_DETAILS);
    for (const id of dummyIds) {
      if (selectedSources.has(id) && !prevSelectedRef.current.has(id)) {
        const details = DUMMY_COUNTRY_DETAILS[id];
        if (details) {
          setDummySubs((prev) => ({ ...prev, [id]: new Set(Object.keys(details)) }));
          const allDetailKeys = new Set<string>();
          for (const subItems of Object.values(details)) {
            for (const key of Object.keys(subItems)) {
              allDetailKeys.add(key);
            }
          }
          setDummyDetails((prev) => ({ ...prev, [id]: allDetailKeys }));
        }
      } else if (!selectedSources.has(id) && prevSelectedRef.current.has(id)) {
        setDummySubs((prev) => ({ ...prev, [id]: new Set() }));
        setDummyDetails((prev) => ({ ...prev, [id]: new Set() }));
      }
    }
    prevSelectedRef.current = new Set(selectedSources);
  }, [selectedSources]);

  // Auto-expand newly enabled jurisdiction
  const prevUSRef = useRef(us.enabled);
  const prevUKRef = useRef(uk.enabled);
  const prevEURef = useRef(eu.enabled);
  useEffect(() => {
    if (us.enabled && !prevUSRef.current) setActiveCountry("us");
    if (uk.enabled && !prevUKRef.current) setActiveCountry("uk");
    if (eu.enabled && !prevEURef.current) setActiveCountry("eu");
    prevUSRef.current = us.enabled;
    prevUKRef.current = uk.enabled;
    prevEURef.current = eu.enabled;
  }, [us.enabled, uk.enabled, eu.enabled]);

  const allStates = StatesOptions.length;

  const hasAnyEnabled =
    selectedSources.size > 0 ||
    us.federal ||
    us.stateCodes.length > 0 ||
    uk.primary ||
    uk.secondary ||
    eu.primary ||
    eu.secondary ||
    Object.values(dummySubs).some((s) => s.size > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onOpenAutoFocus={(e) => e.preventDefault()} className="max-w-208">
        <DialogHeader>
          <DialogTitle className="text-sm font-medium tracking-tight">Add from legal database</DialogTitle>
        </DialogHeader>
        <Card className="overflow-hidden">
          <div className="flex bg-background" style={{ height: 380 }}>
            {/* ── Left column: all countries with checkbox + flag + chevron ── */}
            <div className="flex-1 overflow-y-auto border-r">
              {COUNTRY_SOURCES.map((country) => {
                const isSelected = selectedSources.has(country.id);
                const isExpanded = activeCountry === country.id;
                const isUSUKEU = ["us", "uk", "eu"].includes(country.id);
                const isDummy = country.id in DUMMY_COUNTRY_DETAILS;
                const hasSubs = isUSUKEU || isDummy;

                return (
                  <div key={country.id}>
                    {/* Country row */}
                    <div
                      className={cn(
                        "flex h-9 cursor-pointer items-center gap-3 px-4 hover:bg-muted/50",
                        !isExpanded && "border-b",
                      )}
                      onClick={() => setActiveCountry((p) => (p === country.id ? null : country.id))}
                    >
                      <Checkbox
                        checked={isSelected}
                        onClick={(e) => e.stopPropagation()}
                        onCheckedChange={() => {
                          onToggleSource(country.id);
                          if (!isSelected) setActiveCountry(country.id);
                        }}
                      />
                      <country.Icon className="size-5 shrink-0" />
                      <Label className="pointer-events-none flex-1 cursor-pointer font-medium">{country.label}</Label>
                      {hasSubs &&
                        (isExpanded ? (
                          <ChevronDown className="size-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="size-4 text-muted-foreground" />
                        ))}
                    </div>

                    {/* US sub-categories */}
                    {country.id === "us" && isExpanded && (
                      <div className="border-b">
                        <div className="ml-4 border-l">
                          <div className="flex h-9 items-center gap-3 px-4">
                            <Checkbox
                              checked={us.federal}
                              onCheckedChange={(c) =>
                                setUS((p) => ({
                                  ...p,
                                  federal: !!c,
                                  federalTypes: c ? (Object.keys(Federal_Statutes) as Federal_Statutes_KEY[]) : [],
                                }))
                              }
                            />
                            <Label className="cursor-pointer font-normal">Federal</Label>
                          </div>
                          <div
                            className="flex h-9 cursor-pointer items-center gap-3 px-4"
                            onClick={(e) => {
                              e.stopPropagation();
                              setStatesExpanded(!statesExpanded);
                            }}
                          >
                            <Checkbox
                              checked={us.stateCodes.length === allStates && us.stateCodes.length > 0}
                              onClick={(e) => e.stopPropagation()}
                              onCheckedChange={(c) => {
                                setUS((p) => ({
                                  ...p,
                                  stateCodes: c ? StatesOptions.map(({ value }) => value) : [],
                                  stateTypes: c ? (Object.keys(States_Statutes) as States_Statutes_KEY[]) : [],
                                }));
                                if (c) setStatesExpanded(true);
                              }}
                            />
                            <Label className="pointer-events-none flex-1 cursor-pointer font-normal">States</Label>
                            <span className="text-xs text-muted-foreground">{us.stateCodes.length} Selected</span>
                            {statesExpanded ? (
                              <ChevronDown className="size-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="size-4 text-muted-foreground" />
                            )}
                          </div>
                          {statesExpanded && (
                            <div className="ml-4 border-l">
                              <div className="flex items-center px-4">
                                <Search className="icon text-muted-foreground" />
                                <Input
                                  placeholder="Search States..."
                                  className="border-none"
                                  value={stateSearch}
                                  onChange={(e) => setStateSearch(e.target.value)}
                                />
                              </div>
                              <ul className="h-40 overflow-auto px-4">
                                {StatesOptions.filter(({ label }) =>
                                  label.toLowerCase().includes(stateSearch.trim().toLowerCase()),
                                ).map(({ value, label }) => (
                                  <li key={value} className="flex h-9 items-center gap-3">
                                    <Checkbox
                                      id={`v3-us-${value}`}
                                      checked={us.stateCodes.includes(value)}
                                      onCheckedChange={(c) => {
                                        const nc = c
                                          ? [...us.stateCodes, value]
                                          : us.stateCodes.filter((x) => x !== value);
                                        setUS((p) => ({
                                          ...p,
                                          stateCodes: nc,
                                          stateTypes:
                                            nc.length > 0
                                              ? (Object.keys(States_Statutes) as States_Statutes_KEY[])
                                              : [],
                                        }));
                                      }}
                                    />
                                    <Label htmlFor={`v3-us-${value}`} className="font-normal">
                                      {label}
                                    </Label>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* UK sub-categories */}
                    {country.id === "uk" && isExpanded && (
                      <div className="border-b">
                        <div className="ml-4 border-l">
                          <div className="flex h-9 items-center gap-3 px-4">
                            <Checkbox
                              checked={uk.primary}
                              onCheckedChange={(c) =>
                                setUK((p) => ({
                                  ...p,
                                  primary: !!c,
                                  primaryTypes: c ? (Object.keys(UK_PRIMARY_LEGISLATION) as UK_PRIMARY_KEY[]) : [],
                                }))
                              }
                            />
                            <Label className="cursor-pointer font-normal">Primary Legislation</Label>
                          </div>
                          <div className="flex h-9 items-center gap-3 px-4">
                            <Checkbox
                              checked={uk.secondary}
                              onCheckedChange={(c) =>
                                setUK((p) => ({
                                  ...p,
                                  secondary: !!c,
                                  secondaryTypes: c
                                    ? (Object.keys(UK_SECONDARY_LEGISLATION) as UK_SECONDARY_KEY[])
                                    : [],
                                }))
                              }
                            />
                            <Label className="cursor-pointer font-normal">Secondary Legislation</Label>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* EU sub-categories */}
                    {country.id === "eu" && isExpanded && (
                      <div className="border-b">
                        <div className="ml-4 border-l">
                          <div className="flex h-9 items-center gap-3 px-4">
                            <Checkbox
                              checked={eu.primary}
                              onCheckedChange={(c) =>
                                setEU((p) => ({
                                  ...p,
                                  primary: !!c,
                                  primaryTypes: c ? (Object.keys(EU_PRIMARY_LEGISLATION) as EU_PRIMARY_KEY[]) : [],
                                }))
                              }
                            />
                            <Label className="cursor-pointer font-normal">Primary Legislation</Label>
                          </div>
                          <div className="flex h-9 items-center gap-3 px-4">
                            <Checkbox
                              checked={eu.secondary}
                              onCheckedChange={(c) =>
                                setEU((p) => ({
                                  ...p,
                                  secondary: !!c,
                                  secondaryTypes: c
                                    ? (Object.keys(EU_SECONDARY_LEGISLATION) as EU_SECONDARY_KEY[])
                                    : [],
                                }))
                              }
                            />
                            <Label className="cursor-pointer font-normal">Secondary Legislation</Label>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Dummy country sub-categories */}
                    {isDummy && isExpanded && (
                      <div className="border-b">
                        <div className="ml-4 border-l">
                          {Object.keys(DUMMY_COUNTRY_DETAILS[country.id]).map((subCat) => {
                            const subs = dummySubs[country.id] ?? new Set<string>();
                            return (
                              <div key={subCat} className="flex h-9 items-center gap-3 px-4">
                                <Checkbox
                                  checked={subs.has(subCat)}
                                  onCheckedChange={(c) => {
                                    setDummySubs((prev) => {
                                      const next = new Set(prev[country.id] ?? []);
                                      if (c) {
                                        next.add(subCat);
                                      } else {
                                        next.delete(subCat);
                                      }
                                      return { ...prev, [country.id]: next };
                                    });
                                    // When unchecking a sub-category, remove its detail items
                                    if (!c) {
                                      const detailKeys = Object.keys(DUMMY_COUNTRY_DETAILS[country.id][subCat]);
                                      setDummyDetails((prev) => {
                                        const next = new Set(prev[country.id] ?? []);
                                        for (const dk of detailKeys) next.delete(dk);
                                        return { ...prev, [country.id]: next };
                                      });
                                    } else {
                                      // When checking, add all detail items
                                      const detailKeys = Object.keys(DUMMY_COUNTRY_DETAILS[country.id][subCat]);
                                      setDummyDetails((prev) => {
                                        const next = new Set(prev[country.id] ?? []);
                                        for (const dk of detailKeys) next.add(dk);
                                        return { ...prev, [country.id]: next };
                                      });
                                    }
                                  }}
                                />
                                <Label className="cursor-pointer font-normal">{subCat}</Label>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* ── Right column: accordion tabs with detail checkboxes ── */}
            <div className="flex flex-1 flex-col overflow-auto">
              {/* US accordion tab */}
              {(selectedSources.has("us") || us.federal || us.stateCodes.length > 0) && (
                <>
                  <div
                    className={cn(
                      "flex h-9 shrink-0 cursor-pointer items-center gap-3 px-4 hover:bg-muted/50",
                      activeCountry !== "us" && "border-b",
                    )}
                    onClick={() => setActiveCountry((p) => (p === "us" ? null : "us"))}
                  >
                    <span className="flex-1 text-sm font-medium">US Federal & State Sources</span>
                    {activeCountry === "us" ? (
                      <ChevronDown className="size-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="size-4 text-muted-foreground" />
                    )}
                  </div>
                  {activeCountry === "us" && (
                    <div className="border-b px-4">
                      {us.federal && (
                        <div className="py-1">
                          <p className="py-1 text-xs font-medium text-muted-foreground">Federal</p>
                          {Object.entries(Federal_Statutes).map(([key, label]) => (
                            <div className="flex h-9 items-center gap-3" key={key}>
                              <Checkbox
                                id={`v3-usf-${key}`}
                                checked={us.federalTypes.includes(key as Federal_Statutes_KEY)}
                                onCheckedChange={(c) =>
                                  setUS((p) => ({
                                    ...p,
                                    federalTypes: c
                                      ? [...p.federalTypes, key as Federal_Statutes_KEY]
                                      : p.federalTypes.filter((k) => k !== key),
                                  }))
                                }
                              />
                              <Label htmlFor={`v3-usf-${key}`} className="font-normal">
                                {label}
                              </Label>
                            </div>
                          ))}
                        </div>
                      )}
                      {us.federal && us.stateCodes.length > 0 && <Separator />}
                      {us.stateCodes.length > 0 && (
                        <div className="py-1">
                          <p className="py-1 text-xs font-medium text-muted-foreground">State</p>
                          {Object.entries(States_Statutes).map(([key, label]) => (
                            <div className="flex h-9 items-center gap-3" key={key}>
                              <Checkbox
                                id={`v3-uss-${key}`}
                                checked={us.stateTypes.includes(key as States_Statutes_KEY)}
                                onCheckedChange={(c) =>
                                  setUS((p) => ({
                                    ...p,
                                    stateTypes: c
                                      ? [...p.stateTypes, key as States_Statutes_KEY]
                                      : p.stateTypes.filter((k) => k !== key),
                                  }))
                                }
                              />
                              <Label htmlFor={`v3-uss-${key}`} className="font-normal">
                                {label}
                              </Label>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* UK accordion tab */}
              {(selectedSources.has("uk") || uk.primary || uk.secondary) && (
                <>
                  <div
                    className={cn(
                      "flex h-9 shrink-0 cursor-pointer items-center gap-3 px-4 hover:bg-muted/50",
                      activeCountry !== "uk" && "border-b",
                    )}
                    onClick={() => setActiveCountry((p) => (p === "uk" ? null : "uk"))}
                  >
                    <span className="flex-1 text-sm font-medium">UK Legislation Sources</span>
                    {activeCountry === "uk" ? (
                      <ChevronDown className="size-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="size-4 text-muted-foreground" />
                    )}
                  </div>
                  {activeCountry === "uk" && (
                    <div className="border-b px-4">
                      {uk.primary && (
                        <div className="py-1">
                          <p className="py-1 text-xs font-medium text-muted-foreground">Primary Legislation</p>
                          {Object.entries(UK_PRIMARY_LEGISLATION).map(([key, label]) => (
                            <div className="flex h-9 items-center gap-3" key={key}>
                              <Checkbox
                                id={`v3-ukp-${key}`}
                                checked={uk.primaryTypes.includes(key as UK_PRIMARY_KEY)}
                                onCheckedChange={(c) =>
                                  setUK((p) => ({
                                    ...p,
                                    primaryTypes: c
                                      ? [...p.primaryTypes, key as UK_PRIMARY_KEY]
                                      : p.primaryTypes.filter((k) => k !== key),
                                  }))
                                }
                              />
                              <Label htmlFor={`v3-ukp-${key}`} className="font-normal">
                                {label}
                              </Label>
                            </div>
                          ))}
                        </div>
                      )}
                      {uk.primary && uk.secondary && <Separator />}
                      {uk.secondary && (
                        <div className="py-1">
                          <p className="py-1 text-xs font-medium text-muted-foreground">Secondary Legislation</p>
                          {Object.entries(UK_SECONDARY_LEGISLATION).map(([key, label]) => (
                            <div className="flex h-9 items-center gap-3" key={key}>
                              <Checkbox
                                id={`v3-uks-${key}`}
                                checked={uk.secondaryTypes.includes(key as UK_SECONDARY_KEY)}
                                onCheckedChange={(c) =>
                                  setUK((p) => ({
                                    ...p,
                                    secondaryTypes: c
                                      ? [...p.secondaryTypes, key as UK_SECONDARY_KEY]
                                      : p.secondaryTypes.filter((k) => k !== key),
                                  }))
                                }
                              />
                              <Label htmlFor={`v3-uks-${key}`} className="font-normal">
                                {label}
                              </Label>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* EU accordion tab */}
              {(selectedSources.has("eu") || eu.primary || eu.secondary) && (
                <>
                  <div
                    className={cn(
                      "flex h-9 shrink-0 cursor-pointer items-center gap-3 px-4 hover:bg-muted/50",
                      activeCountry !== "eu" && "border-b",
                    )}
                    onClick={() => setActiveCountry((p) => (p === "eu" ? null : "eu"))}
                  >
                    <span className="flex-1 text-sm font-medium">EU Legislation Sources</span>
                    {activeCountry === "eu" ? (
                      <ChevronDown className="size-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="size-4 text-muted-foreground" />
                    )}
                  </div>
                  {activeCountry === "eu" && (
                    <div className="border-b px-4">
                      {eu.primary && (
                        <div className="py-1">
                          <p className="py-1 text-xs font-medium text-muted-foreground">Primary Legislation</p>
                          {Object.entries(EU_PRIMARY_LEGISLATION).map(([key, label]) => (
                            <div className="flex h-9 items-center gap-3" key={key}>
                              <Checkbox
                                id={`v3-eup-${key}`}
                                checked={eu.primaryTypes.includes(key as EU_PRIMARY_KEY)}
                                onCheckedChange={(c) =>
                                  setEU((p) => ({
                                    ...p,
                                    primaryTypes: c
                                      ? [...p.primaryTypes, key as EU_PRIMARY_KEY]
                                      : p.primaryTypes.filter((k) => k !== key),
                                  }))
                                }
                              />
                              <Label htmlFor={`v3-eup-${key}`} className="font-normal">
                                {label}
                              </Label>
                            </div>
                          ))}
                        </div>
                      )}
                      {eu.primary && eu.secondary && <Separator />}
                      {eu.secondary && (
                        <div className="py-1">
                          <p className="py-1 text-xs font-medium text-muted-foreground">Secondary Legislation</p>
                          {Object.entries(EU_SECONDARY_LEGISLATION).map(([key, label]) => (
                            <div className="flex h-9 items-center gap-3" key={key}>
                              <Checkbox
                                id={`v3-eus-${key}`}
                                checked={eu.secondaryTypes.includes(key as EU_SECONDARY_KEY)}
                                onCheckedChange={(c) =>
                                  setEU((p) => ({
                                    ...p,
                                    secondaryTypes: c
                                      ? [...p.secondaryTypes, key as EU_SECONDARY_KEY]
                                      : p.secondaryTypes.filter((k) => k !== key),
                                  }))
                                }
                              />
                              <Label htmlFor={`v3-eus-${key}`} className="font-normal">
                                {label}
                              </Label>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Dummy country accordion tabs */}
              {COUNTRY_SOURCES.filter(
                (c) =>
                  !["us", "uk", "eu"].includes(c.id) &&
                  (selectedSources.has(c.id) || (dummySubs[c.id]?.size ?? 0) > 0) &&
                  c.id in DUMMY_COUNTRY_DETAILS,
              ).map((country) => {
                const details = DUMMY_COUNTRY_DETAILS[country.id];
                const subs = dummySubs[country.id] ?? new Set<string>();
                const checkedDetails = dummyDetails[country.id] ?? new Set<string>();
                const enabledSubCats = Object.keys(details).filter((sc) => subs.has(sc));

                return (
                  <div key={country.id}>
                    <div
                      className={cn(
                        "flex h-9 shrink-0 cursor-pointer items-center gap-3 px-4 hover:bg-muted/50",
                        activeCountry !== country.id && "border-b",
                      )}
                      onClick={() => setActiveCountry((p) => (p === country.id ? null : country.id))}
                    >
                      <span className="flex-1 text-sm font-medium">{country.label} Sources</span>
                      {activeCountry === country.id ? (
                        <ChevronDown className="size-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="size-4 text-muted-foreground" />
                      )}
                    </div>
                    {activeCountry === country.id && (
                      <div className="border-b px-4">
                        {enabledSubCats.map((subCat, idx) => (
                          <div key={subCat}>
                            {idx > 0 && <Separator />}
                            <div className="py-1">
                              <p className="py-1 text-xs font-medium text-muted-foreground">{subCat}</p>
                              {Object.entries(details[subCat]).map(([key, label]) => (
                                <div className="flex h-9 items-center gap-3" key={key}>
                                  <Checkbox
                                    id={`v3-${country.id}-${key}`}
                                    checked={checkedDetails.has(key)}
                                    onCheckedChange={(c) => {
                                      setDummyDetails((prev) => {
                                        const next = new Set(prev[country.id] ?? []);
                                        if (c) {
                                          next.add(key);
                                        } else {
                                          next.delete(key);
                                        }
                                        return { ...prev, [country.id]: next };
                                      });
                                    }}
                                  />
                                  <Label htmlFor={`v3-${country.id}-${key}`} className="font-normal">
                                    {label}
                                  </Label>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Empty state */}
              {!hasAnyEnabled && (
                <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                  Select a jurisdiction to configure details.
                </div>
              )}
            </div>
          </div>
        </Card>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={() => onOpenChange(false)} disabled={mode === "edit" && !hasChanges}>
            {mode === "edit" ? "Save" : "Add Sources"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Selected integrations stack — overlapping icon chips next to Files and
// Sources. Hover peeks the enabled list; click opens the toggle menu.
// ---------------------------------------------------------------------------
function SelectedIntegrationsStack({
  connectedIntegrations,
  integrationsOff,
  onToggleIntegration,
}: {
  connectedIntegrations: DemoIntegrationItem[];
  integrationsOff: Set<string>;
  onToggleIntegration: (id: string, enabled: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"peek" | "menu">("peek");
  const closeTimer = useRef<number | null>(null);

  const cancelClose = useCallback(() => {
    if (closeTimer.current) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setOpen(false), 150);
  }, [cancelClose]);

  useEffect(() => cancelClose, [cancelClose]);

  const enabled = connectedIntegrations.filter((item) => !integrationsOff.has(item.id));
  if (connectedIntegrations.length === 0) return null;

  const display = enabled.length > 0 ? enabled : connectedIntegrations;
  const allOff = enabled.length === 0;
  const shown = display.length <= 5 ? display : display.slice(0, 4);
  const extra = display.length - shown.length;
  const rowClass =
    "relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 font-medium outline-none hover:bg-muted hover:text-secondary-foreground";

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setMode("peek");
      }}
    >
      <PopoverAnchor asChild>
        <button
          type="button"
          aria-label={`${enabled.length} integrations enabled for this chat`}
          className="flex items-center rounded-full px-1 py-0.5 transition-colors hover:bg-secondary"
          onPointerEnter={() => {
            cancelClose();
            if (!open) {
              setMode("peek");
              setOpen(true);
            }
          }}
          onPointerLeave={() => {
            if (mode === "peek") scheduleClose();
          }}
          onClick={() => {
            cancelClose();
            setMode("menu");
            setOpen(true);
          }}
        >
          {shown.map((item, i) => (
            <span
              key={item.id}
              className={cn(
                "flex size-7 items-center justify-center rounded-full border-2 border-background bg-card shadow-sm",
                i > 0 && "-ml-2",
                allOff && "opacity-60 grayscale",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.icon} alt="" className="size-4" />
            </span>
          ))}
          {extra > 0 && (
            <span className="-ml-2 flex size-7 items-center justify-center rounded-full border-2 border-background bg-card text-2xs font-medium text-muted-foreground shadow-sm">
              +{extra}
            </span>
          )}
        </button>
      </PopoverAnchor>
      <PopoverContent
        side="top"
        align="start"
        className="whitespace-nowrap p-1"
        style={{ minWidth: 240 }}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onPointerEnter={cancelClose}
        onPointerLeave={() => {
          if (mode === "peek") scheduleClose();
        }}
      >
        <p className="px-2 py-1 text-2xs text-muted-foreground">
          {enabled.length > 0
            ? `${enabled.length} integration${enabled.length > 1 ? "s" : ""} enabled for this chat`
            : "No integrations enabled for this chat"}
        </p>
        {mode === "peek" ? (
          <div className="max-h-72 overflow-y-auto">
            {enabled.map((item) => (
              <div key={item.id} className="flex items-center gap-2 rounded-sm px-2 py-1.5 font-medium">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.icon} alt="" className="size-4 shrink-0" />
                <span className="flex-1 pr-2">{item.name}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="max-h-72 overflow-y-auto">
            {connectedIntegrations.map((item) => {
              const on = !integrationsOff.has(item.id);
              return (
                <div key={item.id} className={rowClass} onClick={() => onToggleIntegration(item.id, !on)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.icon} alt="" className="size-4 shrink-0" />
                  <span className="flex-1 pr-2">{item.name}</span>
                  <Switch
                    type="button"
                    size="sm"
                    checked={on}
                    aria-label={`Use ${item.name}`}
                    onClick={(e) => e.stopPropagation()}
                    onCheckedChange={(next) => onToggleIntegration(item.id, next)}
                  />
                </div>
              );
            })}
          </div>
        )}
        <div className="mx-2 my-1 h-px bg-border" />
        <Link href="/assistant/demo/integrations" prefetch={false} className={rowClass} onClick={() => setOpen(false)}>
          <WorkflowIcon className="icon" />
          Manage integrations
        </Link>
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// V3 SourcesDropdown — all legal databases listed inline under section header
// ---------------------------------------------------------------------------
function V3SourcesDropdown({
  onAddFiles,
  selectedSources,
  onToggleSource,
  onAddFromCloud,
}: {
  onAddFiles: () => void;
  selectedSources: Set<string>;
  onToggleSource: (id: string) => void;
  onAddFromCloud: () => void;
}) {
  const [open, setOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollDown, setCanScrollDown] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollDown(el.scrollTop + el.clientHeight < el.scrollHeight - 4);
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(checkScroll, 50);
    return () => clearTimeout(t);
  }, [open, checkScroll]);

  const handleScrollDown = () => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ top: el.clientHeight * 0.75, behavior: "smooth" });
  };

  const handleItem = (label: string) => {
    toast.info(`Demo mode: ${label} disabled.`);
    setOpen(false);
  };

  const itemClass =
    "relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 font-medium outline-none hover:bg-secondary hover:text-secondary-foreground";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="default" type="button">
          <PlusIcon />
          Files and Sources
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="rounded-2xl p-1" sideOffset={4} style={{ minWidth: 244 }}>
        <div ref={scrollRef} className="max-h-80 overflow-y-auto whitespace-nowrap" onScroll={checkScroll}>
          {/* Attach files */}
          <div
            className={itemClass}
            onClick={() => {
              onAddFiles();
              setOpen(false);
            }}
          >
            <PaperclipIcon className="icon" />
            Attach files
          </div>

          {/* Add from Cloud — production CloudDrive selector (mock-backed) */}
          <div
            className={itemClass}
            onClick={() => {
              setOpen(false);
              onAddFromCloud();
            }}
          >
            <UploadCloudIcon className="icon" />
            Add from Cloud
          </div>

          {/* Knowledge Base section header */}
          <div className="my-1 flex items-center px-2">
            <span className="mr-2 text-muted-foreground" style={{ fontSize: 12 }}>
              Add from Knowledge Base
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <div className={itemClass} onClick={() => handleItem("Documents")}>
            <FolderIcon className="icon" />
            Documents
          </div>
          <div className={itemClass} onClick={() => handleItem("Playbook")}>
            <BookIcon className="icon" />
            Playbook
          </div>
          <div className={itemClass} onClick={() => handleItem("DataGrid")}>
            <Table2Icon className="icon" />
            DataGrid
          </div>
          <div className={itemClass} onClick={() => handleItem("Monitor")}>
            <RefreshCw className="icon" />
            Monitor
          </div>

          {/* Ruli's Legal Database section header */}
          <div className="my-1 flex items-center px-2">
            <span className="mr-2 text-muted-foreground" style={{ fontSize: 12 }}>
              Ruli&apos;s Legal Database
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {COUNTRY_SOURCES.map((country) => (
            <div
              key={country.id}
              className={cn(itemClass, selectedSources.has(country.id) && "bg-secondary")}
              onClick={() => onToggleSource(country.id)}
            >
              <country.Icon className="size-5 shrink-0" />
              {country.label}
            </div>
          ))}
        </div>

        {/* Scroll-down hint: full-bleed line + chevron, feels like a button */}
        {canScrollDown && (
          <div className="-mx-1 -mb-1 cursor-pointer hover:bg-secondary/50" onClick={handleScrollDown}>
            <div className="h-px w-full bg-border" />
            <div className="flex justify-center py-1">
              <ChevronDown className="size-3.5 text-muted-foreground" />
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// V2 Attached Sources Dialog — same pattern as v1 but with country sources
// ---------------------------------------------------------------------------
function V2AttachedSourcesDialog({
  open,
  onOpenChange,
  files,
  onSetFiles,
  selectedSources,
  onToggleSource,
  onClearAll,
  onAddFiles,
  onOpenLegalDb,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  files: MockFile[];
  onSetFiles: (files: MockFile[]) => void;
  selectedSources: Set<string>;
  onToggleSource: (id: string) => void;
  onClearAll: () => void;
  onAddFiles: () => void;
  onOpenLegalDb: () => void;
}) {
  const totalCount = files.length + selectedSources.size;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onOpenAutoFocus={(e) => e.preventDefault()} className="max-w-208">
        <DialogHeader>
          <DialogTitle>Attached Sources</DialogTitle>
        </DialogHeader>

        <div className="flex items-center">
          <span className="mr-auto text-sm font-medium">
            {totalCount} source{totalCount !== 1 ? "s" : ""} added
          </span>
          <Button variant="ghost" size="xs" type="button" onClick={onAddFiles}>
            <PlusIcon className="icon" />
            Add
          </Button>
          <Button variant="ghost" size="xs" type="button" onClick={onClearAll}>
            <TrashIcon className="icon" />
            Clear All
          </Button>
        </div>

        <Card className="mt-4">
          <CardContent className="space-y-4 p-4">
            {/* Local files section */}
            {files.length > 0 && (
              <>
                <p>Added from your Laptop</p>
                <div className="max-h-56 space-y-2 overflow-y-auto">
                  {files.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between gap-2 rounded border bg-background p-2"
                    >
                      <IconFile className="icon" filename={file.name} />
                      <TextAutoEllipsis className="line-clamp-2" title={file.name}>
                        {file.name}
                      </TextAutoEllipsis>
                      <div className="mx-auto" />
                      <Button
                        variant="ghost"
                        size="icon-2xs"
                        className="cursor-pointer"
                        onClick={() => onSetFiles(files.filter((f) => f.id !== file.id))}
                      >
                        <XIcon />
                      </Button>
                    </div>
                  ))}
                </div>
                {selectedSources.size > 0 && <Separator />}
              </>
            )}

            {/* Legal Database section */}
            {selectedSources.size > 0 && (
              <>
                <div className="flex items-center justify-between">
                  <p>Ruli&apos;s Legal Database</p>
                  <Button
                    variant="ghost"
                    size="xs"
                    className="cursor-pointer text-muted-foreground"
                    onClick={() => onOpenLegalDb()}
                  >
                    Edit
                  </Button>
                </div>
                <div className="space-y-2">
                  {[...selectedSources].map((id) => {
                    const country = COUNTRY_SOURCES.find((c) => c.id === id);
                    return (
                      <div
                        key={id}
                        className="flex items-center justify-between gap-2 rounded border bg-background p-2"
                      >
                        {country ? (
                          <country.Icon className="size-5 shrink-0" />
                        ) : (
                          <GlobeIcon className="size-5 shrink-0" />
                        )}
                        <span className="flex-1 text-sm">{country?.label ?? id}</span>
                        <Button
                          variant="ghost"
                          size="icon-2xs"
                          className="cursor-pointer"
                          onClick={() => onToggleSource(id)}
                        >
                          <XIcon />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {totalCount === 0 && <p className="text-2xs text-muted-foreground">No sources added</p>}
          </CardContent>
        </Card>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={() => onOpenChange(false)}>Confirm</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// V3 Chat Form — uses V3SourcesDropdown + Legal Database dialog
// ---------------------------------------------------------------------------
function V2ChatForm({
  input,
  setInput,
  isEmpty,
  onSubmit,
  mockFiles,
  onSetFiles,
  onAddFiles,
  selectedSources,
  onToggleSource,
  onClearAll,
  connectedIntegrations,
  integrationsOff,
  onToggleIntegration,
  onAddFromCloud,
}: {
  input: string;
  setInput: (v: string) => void;
  isEmpty: boolean;
  onSubmit: () => void;
  mockFiles: MockFile[];
  onSetFiles: (files: MockFile[]) => void;
  onAddFiles: () => void;
  selectedSources: Set<string>;
  onToggleSource: (id: string) => void;
  onClearAll: () => void;
  connectedIntegrations: DemoIntegrationItem[];
  integrationsOff: Set<string>;
  onToggleIntegration: (id: string, enabled: boolean) => void;
  onAddFromCloud: () => void;
}) {
  const inputRef = useRef<HTMLDivElement>(null);
  const totalSources = mockFiles.length + selectedSources.size;
  const [showSourcesDialog, setShowSourcesDialog] = useState(false);
  const [showLegalDbDialog, setShowLegalDbDialog] = useState(false);
  const [legalDbMode, setLegalDbMode] = useState<"add" | "edit">("add");
  const [magicState, setMagicState] = useState<"idle" | "loading" | "done">("idle");

  const runMagicPrompt = () => {
    if (!input.trim() || magicState === "loading") return;
    const original = input.trim();
    setMagicState("loading");
    window.setTimeout(() => {
      // Demo enhancement: rewrite the user's prompt into a richer, more specific legal ask.
      const capitalized = original.charAt(0).toUpperCase() + original.slice(1);
      const withPunctuation = /[.!?]$/.test(capitalized) ? capitalized : `${capitalized}.`;
      const enhanced =
        `${withPunctuation} Provide a comprehensive legal analysis tailored to the relevant ` +
        `jurisdiction, citing primary statutes, regulations, and controlling case law where ` +
        `applicable. Identify the key risks, ambiguities, and counterparty-favorable terms; ` +
        `flag any deviations from standard market practice. Conclude with concrete recommended ` +
        `next steps and any items that warrant escalation or further diligence.`;
      setInput(enhanced);
      setMagicState("done");
      window.setTimeout(() => setMagicState("idle"), 2400);
    }, 1800);
  };

  return (
    <div className="w-full">
      <V3LegalDatabaseDialog
        open={showLegalDbDialog}
        onOpenChange={setShowLegalDbDialog}
        selectedSources={selectedSources}
        onToggleSource={onToggleSource}
        mode={legalDbMode}
      />
      <V2AttachedSourcesDialog
        open={showSourcesDialog}
        onOpenChange={setShowSourcesDialog}
        files={mockFiles}
        onSetFiles={onSetFiles}
        selectedSources={selectedSources}
        onToggleSource={onToggleSource}
        onClearAll={onClearAll}
        onAddFiles={onAddFiles}
        onOpenLegalDb={() => {
          setShowSourcesDialog(false);
          setLegalDbMode("edit");
          setShowLegalDbDialog(true);
        }}
      />
      <div
        className={cn(
          "rounded-2xl bg-background shadow-chat-rest transition-shadow duration-300 focus-within:shadow-chat-focus dark:shadow-none",
          magicState === "loading" && "magic-loading",
          magicState === "done" && "magic-done",
        )}
      >
        <Card className="w-full rounded-2xl border-0 bg-transparent shadow-none">
          <CardContent className="p-0">
            <form
              className="relative p-4"
              onSubmit={(e) => {
                e.preventDefault();
                onSubmit();
              }}
            >
              <HighlightedInput
                ref={inputRef}
                value={input}
                onChange={setInput}
                placeholder="Ask Ruli anything legal."
                spellCheck={false}
                rows={isEmpty ? 5 : 3}
                maxRows={10}
              />

              <div className="mt-2 flex flex-wrap items-center gap-0.5 md:gap-1.5">
                <V3SourcesDropdown
                  onAddFiles={onAddFiles}
                  selectedSources={selectedSources}
                  onToggleSource={onToggleSource}
                  onAddFromCloud={onAddFromCloud}
                />

                <SelectedIntegrationsStack
                  connectedIntegrations={connectedIntegrations}
                  integrationsOff={integrationsOff}
                  onToggleIntegration={onToggleIntegration}
                />

                {totalSources > 0 && (
                  <Button variant="ghost" size="default" type="button" onClick={() => setShowSourcesDialog(true)}>
                    <FolderIcon />
                    <span>
                      {totalSources} source{totalSources > 1 ? "s" : ""}
                    </span>
                    <ChevronRight className="text-muted-foreground" />
                  </Button>
                )}

                <Button
                  variant="ghost"
                  size="default"
                  type="button"
                  disabled={!input.trim() || magicState === "loading"}
                  onClick={runMagicPrompt}
                  className={cn("magic-sparkle-hover", magicState === "loading" && "text-primary")}
                >
                  <SparklesIcon className={cn(magicState === "loading" && "animate-spin")} />
                  {magicState === "loading" ? "Crafting…" : "Magic Prompt"}
                </Button>
                <div className="mx-auto" />
                <div className="flex items-center gap-3">
                  <Button
                    size="icon-lg"
                    type="button"
                    className="shrink-0 rounded-full bg-avatar-blue-bg text-avatar-blue-fg hover:bg-avatar-blue-bg"
                    onClick={() => toast.info("Demo mode: web search toggle disabled.")}
                  >
                    <GlobeIcon />
                  </Button>
                  <Separator orientation="vertical" className="h-5" />
                  <Button
                    size="icon-lg"
                    variant="ghost"
                    type="button"
                    className="shrink-0 rounded-full text-muted-foreground"
                    onClick={() => toast.info("Demo mode: voice input disabled.")}
                  >
                    <MicIcon />
                  </Button>
                  <Button type="submit" size="icon-lg" className="shrink-0 rounded-lg" disabled={!input.trim()}>
                    <ArrowUp />
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function DemoChatV3Page() {
  const [input, setInput] = useState("");
  const [showMessages, setShowMessages] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set());
  const [mockFiles, setMockFiles] = useState<MockFile[]>([]);
  const scrollContainer = useRef<HTMLDivElement>(null);

  const { connections: gwConnections } = useGoogleWorkspaceDemoConnections();
  const { connections: genericConnections } = useDemoIntegrationConnections();

  // Only connected integrations appear in the chat menu (Claude-style);
  // disconnecting in Integrations removes the row here automatically.
  const connectedIntegrations = useMemo(
    () =>
      DEMO_INTEGRATION_CATEGORIES.flatMap((c) => c.items).filter((item) =>
        item.googleWorkspaceApp ? gwConnections[item.googleWorkspaceApp] : Boolean(genericConnections[item.id]),
      ),
    [gwConnections, genericConnections],
  );

  // Connected apps are ON for the chat by default; this set tracks per-chat opt-outs.
  const [integrationsOff, setIntegrationsOff] = useState<Set<string>>(new Set());
  const [cloudDialogOpen, setCloudDialogOpen] = useState(false);
  const handleToggleIntegration = useCallback((id: string, enabled: boolean) => {
    setIntegrationsOff((prev) => {
      const next = new Set(prev);
      if (enabled) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleToggleSource = useCallback((id: string) => {
    setSelectedSources((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleAddFiles = () => {
    setMockFiles((prev) => {
      const available = MOCK_FILE_POOL.filter((f) => !prev.some((p) => p.id === f.id));
      if (available.length === 0) {
        toast.info("Demo mode: no more mock files to add.");
        return prev;
      }
      return [...prev, available[0]];
    });
  };

  // Clicking "Assistant" breadcrumb while on output page → go back to landing
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest?.('a[href="/assistant/demo/chat"]');
      if (anchor && showMessages) {
        e.preventDefault();
        setShowMessages(false);
        setInput("");
        setActiveConversationId(null);
      }
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [showMessages]);

  // Listen for conversation switch from sidebar chat history
  useEffect(() => {
    const handler = (e: Event) => {
      const { conversationId } = (e as CustomEvent).detail;
      setActiveConversationId(conversationId);
      setShowMessages(true);
      setInput("");
    };
    window.addEventListener("demo-load-conversation", handler);
    return () => window.removeEventListener("demo-load-conversation", handler);
  }, []);

  const handleSubmit = () => {
    if (!showMessages) {
      setShowMessages(true);
      setInput("");
      return;
    }
    toast.info("Demo mode: sending messages is disabled.");
    setInput("");
  };

  const activeMessages: StreamingChatData[] =
    activeConversationId && MOCK_CLAUSE_CONVERSATIONS[activeConversationId]
      ? MOCK_CLAUSE_CONVERSATIONS[activeConversationId].map(
          (m) =>
            ({
              ...m,
              role: m.role as ChatMessageGPTRole,
            }) as StreamingChatData,
        )
      : messages;

  // "Add to Project" — exposes the current chat as a linkable project resource.
  const [addToProject, setAddToProject] = useState<{ payload: AddToProjectPayload; label: string } | null>(null);

  const handleAddChatToProject = useCallback(() => {
    if (!showMessages || activeMessages.length === 0) {
      toast.info("Send or open a chat before linking it to a project.");
      return;
    }
    const firstUserMsg = activeMessages.find((m) => m.role === "user");
    const title = firstUserMsg?.content?.slice(0, 80) ?? "Assistant chat";
    const conversation: ProjectConversation = {
      id: `chat-${activeConversationId ?? Date.now()}`,
      title,
      createdAt: new Date().toISOString(),
      messages: activeMessages.slice(0, 4).map((m, i) => ({
        id: `${m.id ?? i}`,
        authorId: m.role === "user" ? "u-bryan" : "u-sarah",
        content: m.content ?? "",
        createdAt: new Date().toISOString(),
      })),
    };
    setAddToProject({ payload: { kind: "conversation", resource: conversation }, label: title });
  }, [showMessages, activeMessages, activeConversationId]);

  const demoPageActions = (
    <PageActions>
      <Button variant="outline" onClick={handleAddChatToProject}>
        <FolderPlus className="icon-mr text-muted-foreground" />
        Add to project
      </Button>
      <Button
        onClick={() => {
          setShowMessages(false);
          setInput("");
          setActiveConversationId(null);
        }}
      >
        <PlusIcon className="icon mr-2" />
        New Chat
      </Button>
    </PageActions>
  );

  const handleClearAll = useCallback(() => {
    setMockFiles([]);
    setSelectedSources(new Set());
  }, []);

  const formProps = {
    mockFiles,
    onSetFiles: setMockFiles,
    onAddFiles: handleAddFiles,
    selectedSources,
    onToggleSource: handleToggleSource,
    onClearAll: handleClearAll,
    connectedIntegrations,
    integrationsOff,
    onToggleIntegration: handleToggleIntegration,
    onAddFromCloud: () => setCloudDialogOpen(true),
  };

  const cloudPickerDialog = (
    <AddFromCloudDialog
      open={cloudDialogOpen}
      onOpenChange={setCloudDialogOpen}
      connectedDrives={connectedIntegrations.filter((item) => CLOUD_DRIVE_IDS.includes(item.id))}
      attachedIds={new Set(mockFiles.map((f) => f.id))}
      onAdd={(driveName, files) => {
        setMockFiles((prev) => [...prev, ...files.filter((f) => !prev.some((p) => p.id === f.id))]);
        toast.success(`${files.length} file${files.length === 1 ? "" : "s"} added from ${driveName}`);
      }}
    />
  );

  const addToProjectDialog = (
    <AddToProjectDialog
      open={addToProject !== null}
      onOpenChange={(next) => {
        if (!next) setAddToProject(null);
      }}
      payload={addToProject?.payload ?? null}
      resourceLabel={addToProject?.label}
    />
  );

  if (!showMessages) {
    return (
      <div className="flex size-full max-w-216 flex-col self-center px-8">
        {demoPageActions}
        <div className="flex flex-1 flex-col justify-center pb-32">
          <h2 className="text-center" style={{ fontSize: 24 }}>
            Hello, Legal Team.
          </h2>
          <p className="text-center text-muted-foreground" style={{ fontSize: 24, marginTop: 0, marginBottom: 28 }}>
            How can I help you today?
          </p>
          <V2ChatForm input={input} setInput={setInput} isEmpty onSubmit={handleSubmit} {...formProps} />
          <div className="py-2 text-center text-2xs text-muted-foreground">
            <Lock className="inline size-3" /> Your data is secured with enterprise-grade encryption.
          </div>
        </div>
        {addToProjectDialog}
        {cloudPickerDialog}
      </div>
    );
  }

  return (
    <div className="flex size-full flex-col self-center">
      {demoPageActions}
      <CitationsInitializer msgs={activeMessages} />
      <div className="relative flex-1 overflow-y-auto scroll-smooth px-8 pt-6" ref={scrollContainer}>
        <div className="mx-auto max-w-200 space-y-8">
          {activeMessages.map((message, index) => (
            <ChatMessage
              key={message.id}
              message={message}
              messages={activeMessages}
              isLoading={false}
              submitFeedback={async () => {
                toast.info("Demo mode: feedback disabled.");
              }}
              userPrompt={index > 0 ? activeMessages[index - 1].content : undefined}
              setInput={() => {}}
              isHistorical={true}
              isLast={index === activeMessages.length - 1}
            />
          ))}
        </div>
      </div>
      <div className="w-full px-8 pb-2">
        <div className="mx-auto max-w-200">
          <V2ChatForm input={input} setInput={setInput} isEmpty={false} onSubmit={handleSubmit} {...formProps} />
          <div className="py-2 text-center text-2xs text-muted-foreground">
            <Lock className="inline size-3" /> Your data is secured with enterprise-grade encryption.
          </div>
        </div>
      </div>
      {addToProjectDialog}
      {cloudPickerDialog}
    </div>
  );
}
