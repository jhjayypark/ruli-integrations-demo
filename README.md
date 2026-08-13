# Ruli — Integrations Demo (code slice)

Frontend-only demo of the **Integrations catalog + per-chat integration toggles**, extracted from the Ruli prototype for developer review. Live demo: https://contract-lens-five.vercel.app/assistant/demo/integrations (chat: `/assistant/demo/chat`).

This is a **read-only slice**, not a runnable app — it omits the app shell, design system, and the rest of the prototype. Paths mirror the original Next.js 14 App Router repo.

## What it does

- **Integrations page** (`app/(assistant-demo)/assistant/demo/integrations/page.tsx`)
  - Popular row (Gmail / Google Drive / Slack compact connect cards, single row)
  - Sticky category tab bar (All / Comms / Sales / Ticketing / Knowledge / Corporate / Legal) with a name-search input; gains a bottom border + shadow only while stuck (IntersectionObserver sentinel)
  - 29 connectors + Word Extension, each with Connect (1.2 s mock OAuth) / Disconnect (confirm dialog)
- **Chat "Files and Sources" menu** (`app/(assistant-demo)/assistant/demo/chat/page.tsx`, see `V3SourcesDropdown`)
  - Claude-connectors-style flyout: opens on hover, trigger row stays highlighted while open, closes when another menu item is hovered
  - Top entry **Manage integrations** → the Integrations page
  - Lists **connected integrations only**, each a per-chat toggle (default ON); connecting on the page makes the app appear here immediately
- **Add from Cloud modal** (`AddFromCloudDialog.tsx` — ported from production `CloudDriveFileSelector`, reusing the real `FileExplorer`)
  - Single "Add from Cloud" row under Attach files opens the production cloud selector: per-drive icon switcher (selected in color+shadow, rest grayscale), Integrations button, breadcrumbs, folder navigation, contextual search, shift+click range select
  - Backed by mock per-drive folder trees; drives follow the connection store; already-attached files are disabled; Confirm adds the selection to the chat's sources
- **Selected-integrations icon stack** (`SelectedIntegrationsStack` in the chat page)
  - Overlapping circular chips next to Files and Sources showing what's enabled (up to 5 icons, else 4 + "+N")
  - Hover peeks a read-only list; click switches the same popover to the toggle menu (PopoverAnchor + controlled open to avoid Radix trigger toggle-close)

## Key files

| File | Role |
| --- | --- |
| `lib/mock/integrations-demo.ts` | Connector catalog (6 categories × 29 apps: id, name, description, logo, defaultConnected) + generic localStorage connection store (`ruli-demo-integrations`) with cross-tab sync and in-memory fallback |
| `lib/mock/google-workspace-demo.ts` | Gmail / Google Calendar store (`ruli-demo-google-workspace`) — kept separate because these two also drive the scripted Gmail/Calendar citation flow (PR #2645 replica) |
| `app/(assistant-demo)/assistant/demo/integrations/page.tsx` | Integrations page (Popular + tabs + category grids) |
| `app/(assistant-demo)/assistant/demo/chat/page.tsx` | Demo chat; `V3SourcesDropdown` holds the Integrations flyout (search `Manage integrations`) |
| `app/(assistant-demo)/assistant/demo/settings/integrations/page.tsx` | Legacy path → redirects to `/assistant/demo/integrations` |
| `components/settings/integrations/IntegrationCard.tsx` | Production card component reused by the page |
| `components/layout/DemoLayoutProvider.tsx` | Demo sidebar nav wiring (Integrations is a top-level item, highlight rules) |
| `docs/superpowers/specs/2026-08-10-google-workspace-demo-design.md` | Original design spec (Google Workspace connector demo, PR #2645 replica) |
| `public/logos/` | Brand logos (SVG preferred; PNG favicon fallback for a few) |

## Implementation notes

- Connection state is client-only: two localStorage stores, synced across tabs via `storage` + a same-tab `CustomEvent`; SSR/incognito fall back to in-memory state.
- Per-chat toggle state is an **opt-out set** — a connected app is ON for the chat unless the user switched it off; disconnecting removes it from the menu entirely.
- Flyout close-on-hover uses a `pointerover` handler on the menu scroll container. Radix portals bubble events through the **React** tree, so the handler requires `e.currentTarget.contains(e.target)` (DOM containment) to avoid an open/close flicker while the pointer is inside the flyout.
- Styling follows the host repo conventions: Tailwind + shadcn/ui, semantic tokens only, icons via the repo's `lucide-shim` (Nucleo Micro Bold).
