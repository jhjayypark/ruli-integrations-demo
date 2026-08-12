# Google Workspace Connector Demo (PR #2645 replica)

**Date**: 2026-08-10 **Branch**: `feat/google-workspace-demo` (worktree `.worktrees/google-workspace-demo`, base `feat/admin-control-demo` @ abc15ee6) **Source**: ruliai/ruli PR #2645 — "Support Nango connector for Claude-like agentic query" (fetched read-only as local branch `pr-2645-head`, merge-base c8b8fe658)

## Goal

Replicate the user-visible surface of PR #2645 as a frontend-only demo, using the established `/assistant/demo/*` pattern (mock data, no backend, no auth). Three flows, end to end:

1. **Settings → Integrations**: connect/disconnect Gmail and Google Calendar.
2. **Chat → Add Source › Integrations**: per-chat Gmail / Google Calendar toggles.
3. **Chat answer**: scripted agentic tool playback + streamed answer with Gmail and Google Calendar citations (inline tooltip + right citation panel).

Out of scope (YAGNI): all Nango/backend code, sidebar slimming for the `GOOGLE_WORKSPACE_APP_REVIEW` org, `docx-export` citation additions, `CloudDriveFileSelector` changes, real OAuth.

## Approach (approved: hybrid)

- **Citation pipeline = port the PR diff verbatim** into the shared components the demo already renders through (`ChatMessage` → `parseMessage` → citation tooltip/panel). Production-identical rendering for free.
- **Chat form + settings page = extend the existing demo components** with PR-equivalent UI (the demo chat deliberately uses a custom rebuilt form, not the production `ChatForm`).
- **Agentic playback = demo-only scripted player** (no production analogue is reachable without backend).

## Changes

### A. Shared citation pipeline — ported from the PR as-is

| File | Change (same diff as PR #2645) |
| --- | --- |
| `lib/json-types.ts` | `CitationType.GMAIL` / `GOOGLE_CALENDAR`; `GmailCitation`, `GoogleCalendarCitation` types; extend `Citation` union. (Skip the `FocusPayload.gmail/googleCalendar` additions — demo does not build focus payloads.) |
| `components/citation-util.ts` | Group identifiers: `thread_id` (Gmail), `event_id` (Calendar). |
| `components/copilot/ChatMessage/Citations.tsx` | `GmailLogoIcon`, `GoogleCalendarLogoIcon`, `GoogleDriveLogoIcon` img-icon components; two new `CitationMeta` entries. |
| `components/copilot/ChatMessage/CitationItem.tsx` | Inline-citation tooltips: Gmail (subject + snippet + "Open Gmail Thread" link), Calendar (Start/End/Location/Attendees + "Open Calendar Event" link); Drive-URL citations get the Drive logo. |
| `components/copilot/ChatMessage/CitationPanel.tsx` | Citation-panel cards: Gmail (From/To/Date metadata block), Calendar (event metadata block); Drive-URL logo + tooltip label. |
| `public/logos/logo_googlecalendar.svg` | Extracted from the PR commit. |

### B. Demo connection store (new file `lib/mock/google-workspace-demo.ts`)

- localStorage key `ruli-demo-google-workspace`: `{ gmail: boolean, googleCalendar: boolean }`. Default: both disconnected.
- Hook `useGoogleWorkspaceDemoConnections()` — reads on mount, subscribes to `storage` + a same-tab custom event so the chat menu and the settings page stay in sync; exposes `connect(type)` / `disconnect(type)`.
- Also exports the scripted scenario data (section D).

### C. Settings → Integrations (`app/(assistant-demo)/assistant/demo/settings/integrations/page.tsx`)

Rebuild the current simple-list demo page as the production post-PR layout: single `IntegrationCard` grid (`grid-cols-1 @md/main:grid-cols-2 @xl/main:grid-cols-3`, no tabs), reusing `components/settings/integrations/IntegrationCard`:

- **Google Drive**, **OneDrive** — cloud drives, mock-connected (static "connected", disconnect shows demo toast).
- **Gmail** — description from the PR: "Allow Ruli to search and reference Gmail threads. Tools: Search Threads, Get Thread."
- **Google Calendar** — "Allow Ruli to search and reference calendar events. Tools: Search Events, Get Event Details."
- **Word Extension** — Install button linking to AppSource (as in the PR).

Gmail/Calendar connect: click → ~1.2s connecting spinner → connected (persisted via the store). Disconnect: confirm dialog copy from the PR ("Disconnecting X will stop the assistant from using it in chats.") → disconnected.

### D. Chat (`app/(assistant-demo)/assistant/demo/chat/page.tsx`)

1. **Sources menu**: add an "Integrations" row to `V3SourcesDropdown` (below the Knowledge Base section), opening a right-side sub-popover on hover/click — same structure as the PR's `AddSourceMenu.extraMenuContent`. Rows: Gmail and Google Calendar, each `logo + name + Switch (size sm)`, `text-avatar-blue-fg` when enabled. Not connected → row disabled + tooltip "Connect Gmail in Settings → Integrations." Connected → tooltip copy from the PR ("Ruli can search Gmail when relevant." / "Ruli will not use Gmail for this chat.").
2. **Per-chat enable state**: `{ gmail: boolean, googleCalendar: boolean }` page state; auto-disabled if the integration disconnects (mirrors the PR effect).
3. **Scripted playback** (when ≥1 toggle is on and the user submits any question):
   - Append the typed question as the user message.
   - Play a demo-only **AgentActivity** block (component colocated in the chat route dir): sequential steps with logo icons and check marks — `Searching Gmail — "Acme MSA indemnification"` → `Found 3 threads` → `Reading "Re: Acme MSA — Indemnification cap"` → `Searching Google Calendar — "Acme"` → `Found 1 upcoming event`. (Calendar steps skipped if only Gmail is enabled, and vice versa.)
   - Stream the assistant answer (typewriter, existing demo cadence), then attach `annotations.sources` so `CitationsInitializer` populates the citation panel.
4. **Scenario content** (suggestion chip on the empty state; also used for any typed question):
   - Question: _"What did we agree with Acme on the indemnification cap, and when is our next negotiation call?"_
   - Answer: short summary — Acme accepted a 12-month-fees cap with carve-outs for IP infringement and confidentiality breaches [1], their redline dropped the gross-negligence carve-out which we pushed back on [2], and the next negotiation call is scheduled for Thu Aug 13, 2:00–3:00 PM PT with named attendees [3].
   - Citations: [1] `GMAIL` thread "Re: Acme MSA — Indemnification cap" (from/to/date/snippet + mail.google.com URL), [2] `GMAIL` thread "Acme MSA — redline v3" , [3] `GOOGLE_CALENDAR` event "Acme MSA — negotiation call" (start/end/location=Google Meet/attendees + calendar.google.com htmlLink).
   - All names/addresses fictional (acme.example / ruli.example domains).
5. **Toggles all off** → existing static demo behavior unchanged.

## Error handling / edge cases

- Storage unavailable (SSR/incognito): store falls back to in-memory defaults; never throws.
- Disconnect while a chat has the toggle on → toggle auto-off (PR parity).
- "New Chat" / breadcrumb reset → clears playback state and toggles remain as set.
- Playback is interruptible by "New Chat" (timers cleaned up on unmount).

## Verification

- Baseline: 163 pre-existing type-check errors on the base commit (recorded). Gate: **no new** type-check errors, no new lint errors in touched files.
- `pnpm lint` on changed files; `pnpm unit` unaffected (no tests touch these paths; spot-run `components/copilot` suites if any).
- Manual: dev server on port 3000 (kill orphaned `next-server` by cwd first), Playwright walk-through — connect in settings → toggle in chat → run scenario → hover inline citations → open citation panel → disconnect → toggle auto-off.
