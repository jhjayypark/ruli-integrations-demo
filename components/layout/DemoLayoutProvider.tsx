"use client";

import { LayoutContextProvider, OnFileDrop } from "@/components/layout/context";
import { getNavsNew, useNavs, type Nav } from "@/components/layout/LeftSidebar/menus";
import { OnboardingProvider } from "@/components/user-onboarding/OnboardingContext";
import { MOCK_SESSION } from "@/lib/mock/word-demo-data";
import { AppView, UserRole } from "@prisma/client";
import { BotIcon, Layers3Icon, RefreshCw, SparklesIcon } from "@/components/ui/lucide-shim";
import { Session } from "next-auth";
import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { isPathAllowed, type ProductAccess } from "@/lib/contract-lens/product-access";
import { useViewerAccess } from "@/lib/contract-lens/team-members";

function buildDemoHrefMap(prefix: string): Record<string, string> {
  return {
    "/copilot": `${prefix}/chat`,
    "/research": `${prefix}/research`,
    "/legislation": `${prefix}/monitor`,
    "/legislation/private": `${prefix}/monitor`,
    "/report": `${prefix}/datagrid`,
    "/knowledge-base": `${prefix}/knowledge-base/team`,
    "/knowledge-base/private": `${prefix}/knowledge-base`,
    "/contract-repo": `${prefix}`,
    "/playbooks": `${prefix}/playbooks`,
    "/clause-library": `${prefix}/clause-library`,
    "/settings/profile": `${prefix}/settings/profile`,
    "/settings/source-filters": `${prefix}/settings/source-filters`,
    "/settings/team-management": `${prefix}/settings/team-management`,
    "/settings/company-profile": `${prefix}/settings/company-profile`,
    "/settings/preferred-language": `${prefix}/settings/preferred-language`,
    "/settings/integrations": `${prefix}/integrations`,
  };
}

function remapNavHrefs(navs: Nav[], hrefMap: Record<string, string>): Nav[] {
  return navs.map((nav) => {
    const mappedHref = nav.href ? (hrefMap[nav.href] ?? nav.href) : nav.href;
    const children = nav.children ? remapNavHrefs(nav.children, hrefMap) : undefined;
    return {
      ...nav,
      href: mappedHref,
      autoAppendNewId: mappedHref !== nav.href ? false : nav.autoAppendNewId,
      children,
    };
  });
}

// Product-scoped viewers only see the sidebar entries their access type
// allows (registry-driven — see lib/contract-lens/product-access.ts). A
// group survives if any of its children do; disabled placeholders drop.
function filterNavsForAccess(navs: Nav[], access: ProductAccess): Nav[] {
  if (access === "full") return navs;
  const out: Nav[] = [];
  for (const nav of navs) {
    if (nav.disabled) continue;
    const children = nav.children ? filterNavsForAccess(nav.children, access) : undefined;
    const selfAllowed = nav.href ? isPathAllowed(access, nav.href) : false;
    if (selfAllowed || (children && children.length > 0)) out.push({ ...nav, children });
  }
  return out;
}

export function DemoLayoutProvider({
  children,
  visibleNavNames,
  demoPrefix = "/assistant/demo",
  customNavs,
}: {
  children: React.ReactNode;
  /** When provided, only top-level navs whose name is in this list are shown in the sidebar. */
  visibleNavNames?: string[];
  /** Base path prefix for demo routes (default: "/assistant/demo"). */
  demoPrefix?: string;
  /** When provided, replaces the default demo navigation entirely. */
  customNavs?: Nav[];
}) {
  const onFilesDropRef = useRef<OnFileDrop>(null);
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [rightSidebarOpen, setRightSidebarOpen] = useState<boolean | null>(null);
  const [RightSidebar, setRightSidebar] = useState<JSX.Element | null>(null);
  const [rightSidebarStyle, setRightSidebarStyle] = useState<React.CSSProperties>({});
  const [rightSidebarToggleStyle, setRightSidebarToggleStyle] = useState<React.CSSProperties>({});
  const [AfterHeader, setAfterHeader] = useState<JSX.Element | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const resultsOfUseNavs = useNavs();
  const [pageTitles, setPageTitles] = useState<ReactNode[]>([]);
  const [pageActions, setPageActions] = useState<ReactNode>(null);
  const pathname = usePathname();
  const viewerAccess = useViewerAccess();

  const userRoleMode = { real_roles: [UserRole.LEGAL], display_role: UserRole.LEGAL };

  // Use static navs from MOCK_SESSION as fallback (ASSISTANT view only to avoid duplicate Settings)
  const staticNavs = useMemo(
    () =>
      getNavsNew(MOCK_SESSION as unknown as Session).filter(
        (nav) => (nav.appView ?? AppView.ASSISTANT) === AppView.ASSISTANT,
      ),
    [],
  );
  const hrefMap = useMemo(() => buildDemoHrefMap(demoPrefix), [demoPrefix]);

  const demoNavs = useMemo(() => {
    const base = resultsOfUseNavs.navs.length > 0 ? resultsOfUseNavs.navs : staticNavs;
    const remapped = remapNavHrefs(base, hrefMap);

    // Find original navs
    const assistantNav = remapped.find((nav) => nav.name === "Assistant");
    const monitorChild = assistantNav?.children?.find((c) => c.name === "Monitor");
    const dataGrid = remapped.find((nav) => nav.name === "DataGrid");
    const contractLens = remapped.find((nav) => nav.name === "Contract Lens");
    const knowledgeBase = remapped.find((nav) => nav.name === "Knowledge Base");
    const integrations = remapped.find((nav) => nav.name === "Integrations");
    const settings = remapped.find((nav) => nav.name === "Settings");

    // Flatten: Assistant becomes a direct link (no children), Monitor is top-level
    const flatAssistant: Nav = {
      name: "Assistant",
      href: `${demoPrefix}/chat`,
      icon: assistantNav?.icon ?? <SparklesIcon className="icon" />,
      exact: false,
      // Stay highlighted on project / research / playbooks / clause-library too
      alternativeHighlightPrefixes: [
        `${demoPrefix}/project`,
        `${demoPrefix}/research`,
        `${demoPrefix}/playbooks`,
        `${demoPrefix}/clause-library`,
      ],
    };
    const flatMonitor: Nav = {
      name: "Monitor",
      href: monitorChild?.href ?? `${demoPrefix}/monitor`,
      icon: monitorChild?.icon ?? <RefreshCw className="icon" />,
      exact: false,
    };

    const isContractLensDemo = demoPrefix === "/contract-lens/demo";
    const isAgentsDemo = demoPrefix === "/agents/demo";
    const dimOthers = isContractLensDemo || isAgentsDemo;

    // Assistant stays clickable from every demo — it jumps back to the
    // assistant demo chat rather than dimming out like the other entries.
    const result: Nav[] = [dimOthers ? { ...flatAssistant, href: "/assistant/demo/chat" } : flatAssistant];
    if (dataGrid) result.push({ ...dataGrid, disabled: dimOthers });
    const contractLensEntry = contractLens ?? {
      name: "Contract Lens",
      href: isContractLensDemo ? demoPrefix : "/contract-lens/demo",
      icon: <Layers3Icon className="icon" />,
      exact: false,
    };

    if (isContractLensDemo) {
      result.push({
        ...contractLensEntry,
        reorderableChildren: true,
        reorderKey: "contract-lens-demo-nav-order",
        children: [
          {
            name: "Repository",
            href: demoPrefix,
            exact: true,
          },
          {
            name: "Deviation Analysis",
            href: `${demoPrefix}/deviation-analysis`,
            exact: false,
          },
          {
            name: "Dashboard",
            href: `${demoPrefix}/dashboard`,
            exact: false,
          },
          {
            // Settings holds two inner tabs: Evaluation Defaults and
            // Alerts. Lit on any /settings/* route, plus the legacy
            // /alerts route (which now redirects into Settings).
            name: "Settings",
            href: `${demoPrefix}/settings`,
            exact: false,
            alternativeHighlightPrefixes: [`${demoPrefix}/alerts`],
          },
        ],
      });
    } else {
      // Outside the Contract Lens demo its href may have been remapped to the
      // current prefix; point it back at the Contract Lens demo explicitly.
      result.push({ ...contractLensEntry, href: "/contract-lens/demo", exact: false });
    }

    // Automation Agents console (PRD: ruli-agents-prd.md). Full sub-nav
    // inside its own demo; a cross-link entry everywhere else.
    const agentsEntry: Nav = {
      name: "Agents",
      href: isAgentsDemo ? demoPrefix : "/agents/demo",
      icon: <BotIcon className="icon" />,
      exact: false,
    };
    if (isAgentsDemo) {
      result.push({
        ...agentsEntry,
        reorderableChildren: true,
        reorderKey: "agents-demo-nav-order",
        children: [
          {
            name: "Overview",
            href: demoPrefix,
            exact: true,
            alternativeHighlightPrefixes: [
              `${demoPrefix}/new`,
              `${demoPrefix}/policy-faq`,
              `${demoPrefix}/nda-review`,
              `${demoPrefix}/marketing-review`,
              `${demoPrefix}/vendor-dpa`,
              `${demoPrefix}/custom-draft`,
            ],
          },
          {
            name: "Review Queue",
            href: `${demoPrefix}/queue`,
            exact: false,
          },
          {
            name: "Decision Log",
            href: `${demoPrefix}/decisions`,
            exact: false,
          },
          {
            name: "Reports",
            href: `${demoPrefix}/reports`,
            exact: false,
          },
          {
            name: "Memory",
            href: `${demoPrefix}/memory`,
            exact: false,
          },
        ],
      });
    } else {
      result.push(agentsEntry);
    }

    result.push({ ...flatMonitor, disabled: dimOthers });
    if (knowledgeBase) result.push({ ...knowledgeBase, disabled: dimOthers, separatorBefore: true });
    if (integrations) result.push({ ...integrations, disabled: dimOthers });
    if (settings) {
      result.push({
        ...settings,
        showChildrenViaTabs: false,
        children: undefined,
        href: `${demoPrefix}/settings/profile`,
        alternativeHighlightPrefixes: [`${demoPrefix}/settings`],
        disabled: dimOthers,
      });
    }
    return result;
  }, [resultsOfUseNavs.navs, staticNavs, hrefMap, demoPrefix]);

  const filteredDemoNavs = useMemo(() => {
    let source = customNavs && customNavs.length > 0 ? customNavs : demoNavs;
    if (visibleNavNames && visibleNavNames.length > 0) {
      source = source.filter((nav) => visibleNavNames.includes(nav.name));
    }
    // Product-scoped viewers (Settings → Team Management access types) only
    // see the product areas their access allows.
    return filterNavsForAccess(source, viewerAccess);
  }, [demoNavs, visibleNavNames, customNavs, viewerAccess]);

  const demoMatched = useMemo(() => {
    const _matched: Nav[] = [];
    function dfs(node: Nav): boolean {
      if (node.href) {
        if (node.exact ? node.href === pathname : pathname.startsWith(node.href)) {
          _matched.push(node);
          return true;
        }
      }
      if (node.alternativeHighlightPrefixes?.some((prefix) => pathname.startsWith(prefix))) {
        _matched.push(node);
        return true;
      }
      if (node.children) {
        _matched.push(node);
        for (const child of node.children) {
          if (dfs(child)) return true;
        }
        _matched.pop();
      }
      return false;
    }
    for (const node of filteredDemoNavs) {
      if (dfs(node)) break;
    }
    return _matched;
  }, [filteredDemoNavs, pathname]);

  useEffect(() => {
    const mql = window.matchMedia("(max-width: 599px)");
    const onChange = () => setIsMobile(window.innerWidth < 600);
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < 600);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    setRightSidebarOpen(RightSidebar ? true : null);
  }, [RightSidebar]);

  const pushTitle = useCallback((title: ReactNode) => {
    setPageTitles((prev) => [...prev, title]);
  }, []);

  const popTitle = useCallback(() => {
    setPageTitles((prev) => (prev.length === 0 ? prev : prev.slice(0, -1)));
  }, []);

  return (
    <LayoutContextProvider
      value={{
        onFilesDropRef,
        leftSidebarOpen,
        setLeftSidebarOpen,
        rightSidebarOpen,
        setRightSidebarOpen,
        RightSidebar,
        setRightSidebar,
        rightSidebarStyle,
        setRightSidebarStyle,
        rightSidebarToggleStyle,
        setRightSidebarToggleStyle,
        isLegal: true,
        isMobile,
        user: MOCK_SESSION.user,
        userRoleMode,
        updateRole: async () => null,
        ...resultsOfUseNavs,
        navs: filteredDemoNavs,
        matched: demoMatched,
        pageTitles,
        setPageTitles,
        pushTitle,
        popTitle,
        pageActions,
        setPageActions,
        AfterHeader,
        setAfterHeader,
      }}
      memo
    >
      <OnboardingProvider key={resultsOfUseNavs.appView}>{children}</OnboardingProvider>
    </LayoutContextProvider>
  );
}
