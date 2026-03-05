# PROJECT STATUS - Protosphere Community Platform

> **Single Source of Truth** for project state

## Current State

```yaml
project_phase: "Active Development — M16 UI Redesign"
protogear_enabled: true
framework: "Vue 3 + TypeScript 5.9 + Vite 7 + Tailwind CSS 4 + Pinia + Supabase"
project_type: "Single-Community Communication Platform"
initialization_date: "2026-02-20"
current_milestone: "M16 — UI Redesign"
local_supabase: true
```

## Vision Pivot (2026-02-22)

Protosphere is evolving from a generic multi-server Discord clone into **the central communication hub for a single online community**. Key shifts:

- **Hybrid community**: public-facing spaces + private areas for trusted members
- **Servers → Spaces**: sub-communities within one shared identity
- **Custom roles**: replace fixed 4-tier hierarchy with granular permission bitfields
- **Community identity**: branding, onboarding, moderation, engagement features
- M10 (basic Supabase integration) is superseded — real-time work moves to M15

## Architecture

```
composables → backend (interface) → local.ts | supabase-backend.ts
```

Backend adapter auto-detects mode via `VITE_SUPABASE_URL` env var. Local mode uses localStorage, Supabase mode wraps the real client. Composables are backend-agnostic. Local Supabase via Docker for dev.

---

## Active Tickets

### M16 — UI Redesign ✅

| Ticket | Title | Status | Description |
|--------|-------|--------|-------------|
| PTSPH-147 | Horizontal community top bar | ✅ Done | Redesign `CommunitySidebar.vue` from vertical w-60 column to full-width h-12 top bar; restructure `AppShell.vue` to flex-col; polls icon moves left of input, emoji moves right |

---

### M11 — Roles & Permissions Engine ✅

**Goal:** Replace hardcoded `owner > admin > moderator > member` with flexible custom roles + permission bitfields.

| Ticket | Title | Status | Description |
|--------|-------|--------|-------------|
| PTSPH-100 | Permission bitfield library | ✅ Done | `src/lib/permissions.ts`: Permission constants, `hasPermission()`, `computePermissions()`, preset templates |
| PTSPH-101 | Missing channel_categories migration | ✅ Done | `006_channel_categories.sql` |
| PTSPH-102 | Roles schema migration | ✅ Done | `007_roles_permissions.sql`: `roles`, `user_roles`, `channel_role_overrides` + data migration |
| PTSPH-103 | Backend interface: roles | ✅ Done | `roles` namespace in both `local.ts` and `supabase-backend.ts` |
| PTSPH-104 | Roles store & composables | ✅ Done | `stores/roles.ts`, `useRoles.ts`, `usePermissions.ts` |
| PTSPH-105 | Migrate UI permission checks | ✅ Done | All `myRole ===` patterns replaced with `can(Permission.X)` |
| PTSPH-106 | Role management UI | ✅ Done | Roles tab in space settings, color picker, drag-to-reorder |
| PTSPH-107 | RLS policies for permissions | ✅ Done | `008_rls_roles.sql` |

### M12 — Spaces & Community Identity ✅

**Goal:** Reframe app as single community with spaces. Add branding, visibility controls, onboarding.

| Ticket | Title | Status | Description |
|--------|-------|--------|-------------|
| PTSPH-110 | Community settings entity | ✅ Done | `community_settings` table, `useCommunity.ts`, `stores/community.ts` |
| PTSPH-111 | Server → Space rename (UI) | ✅ Done | UI labels updated throughout |
| PTSPH-112 | Space visibility & types | ✅ Done | `visibility` + `space_type` columns on servers |
| PTSPH-113 | Community sidebar redesign | ✅ Done | `CommunitySidebar.vue` replaces old icon sidebar |
| PTSPH-114 | Community admin panel | ✅ Done | `CommunitySettingsPage.vue` at `/admin/community` |
| PTSPH-115 | Onboarding flow | ✅ Done | `LandingPage.vue`, welcome screen, registration approval support |
| PTSPH-116 | Space access control | ✅ Done | Visibility + join gating by role |

### M13 — Moderation & Safety ✅

**Goal:** Audit logging, reporting, mod queue, mutes, auto-moderation.

| Ticket | Title | Status | Description |
|--------|-------|--------|-------------|
| PTSPH-120 | Audit log infrastructure | ✅ Done | `audit_log` table, `auditLog.ts` helper, backend namespace |
| PTSPH-121 | Wire moderation to audit log | ✅ Done | kick/ban/unban/role-change/channel-CRUD/message-delete emit audit entries |
| PTSPH-122 | Audit log viewer | ✅ Done | `AuditLogViewer.vue` in space settings (Audit Log tab) |
| PTSPH-123 | Report system | ✅ Done | `reports` table, `ReportDialog.vue`, "Report" in context menus |
| PTSPH-124 | Mod queue | ✅ Done | `ModQueuePage.vue` at `/admin/modqueue` |
| PTSPH-125 | Mute system | ✅ Done | `mutes` table, `useMutes.ts`, mute check on send, "Mute" in context menu |
| PTSPH-126 | Auto-moderation | ✅ Done | `automod_rules` table, `automod.ts`: word filter + spam detection, config in settings |

### M14 — Engagement Features ✅

**Goal:** Threads, polls, events, announcement spaces.

| Ticket | Title | Status | Description |
|--------|-------|--------|-------------|
| PTSPH-130 | Thread data model & backend | ✅ Done | `parent_message_id` + `parent_channel_id` on channels; `threads` namespace |
| PTSPH-131 | Thread UI | ✅ Done | "Create Thread" on messages, `ThreadPanel.vue` in members sidebar |
| PTSPH-132 | Poll data model & backend | ✅ Done | `polls`, `poll_options`, `poll_votes` tables; `polls` namespace |
| PTSPH-133 | Poll UI | ✅ Done | `CreatePollDialog.vue`, `PollCard.vue`, polls panel in sidebar |
| PTSPH-134 | Announcement spaces | ✅ Done | `space_type === 'announcement'`: `canPostInChannel` guard on `MANAGE_MESSAGES` |
| PTSPH-135 | Events system | ✅ Done | `events` + `event_rsvps` tables; `EventsPanel.vue` with RSVP buttons |

### M15 — Supabase Real-time & Integration ✅

**Goal:** Complete Supabase backend, real-time across clients, production-ready.

| Ticket | Title | Status | Description |
|--------|-------|--------|-------------|
| PTSPH-140 | Supabase migration validation | ✅ Done | Migrations 001–017 reviewed; 018 adds missing coverage |
| PTSPH-141 | RLS policies for all new tables | ✅ Done | 018_rls_m15.sql: mutes UPDATE, poll_options/votes member-scoped, event_rsvps member-scoped, supabase_realtime publication |
| PTSPH-142 | Supabase backend: new namespaces | ✅ Done | All namespaces implemented in supabase-backend.ts across M11–M14 |
| PTSPH-143 | Real-time messages | ✅ Done | useRealtime.ts: postgres_changes INSERT/UPDATE/DELETE subscriptions; channel-scoped; deduped |
| PTSPH-144 | Real-time presence | ✅ Done | stores/presence.ts Pinia store; Realtime Presence channel per server; usePresence.ts calls trackPresenceStatus; member list uses live statuses |
| PTSPH-145 | Real-time typing | ✅ Done | Realtime Broadcast per channel; broadcastTyping/broadcastStopTyping; displayTypingUsers computed switches by mode |
| PTSPH-146 | End-to-end testing | ✅ Done | Manual testing checklist: db reset, RLS verification, 2-tab realtime validation |

---

## Milestone Dependencies

```
M11 (Roles & Permissions) ──┐
                             ├─→ M13 (Moderation) ──┐
M12 (Spaces & Community) ───┤                       ├─→ M15 (Supabase & Real-time)
                             └─→ M14 (Engagement) ──┘
```

---

## Completed Milestones

### M15 — Supabase Real-time & Integration (2026-02-28)

| Ticket | Title | Completed |
|--------|-------|-----------|
| PTSPH-140 | Supabase migration validation | 2026-02-28 |
| PTSPH-141 | RLS policies (018_rls_m15.sql) | 2026-02-28 |
| PTSPH-142 | Supabase backend namespaces complete | 2026-02-28 |
| PTSPH-143 | Real-time messages (postgres_changes) | 2026-02-28 |
| PTSPH-144 | Real-time presence (Realtime Presence) | 2026-02-28 |
| PTSPH-145 | Real-time typing (Realtime Broadcast) | 2026-02-28 |
| PTSPH-146 | E2E testing | 2026-02-28 |

### M14 — Engagement Features (2026-02-28)

| Ticket | Title | Completed |
|--------|-------|-----------|
| PTSPH-130 | Thread data model & backend | 2026-02-28 |
| PTSPH-131 | Thread UI (ThreadPanel) | 2026-02-28 |
| PTSPH-132 | Poll data model & backend | 2026-02-28 |
| PTSPH-133 | Poll UI (CreatePollDialog, PollCard, polls sidebar panel) | 2026-02-28 |
| PTSPH-134 | Announcement spaces (canPostInChannel guard) | 2026-02-28 |
| PTSPH-135 | Events system (EventsPanel, RSVP) | 2026-02-28 |

### M13 — Moderation & Safety (2026-02-28)

| Ticket | Title | Completed |
|--------|-------|-----------|
| PTSPH-120 | Audit log infrastructure | 2026-02-28 |
| PTSPH-121 | Wire moderation to audit log | 2026-02-28 |
| PTSPH-122 | Audit log viewer | 2026-02-28 |
| PTSPH-123 | Report system | 2026-02-28 |
| PTSPH-124 | Mod queue page | 2026-02-28 |
| PTSPH-125 | Mute system | 2026-02-28 |
| PTSPH-126 | Auto-moderation | 2026-02-28 |

### M12 — Spaces & Community Identity (2026-02-28)

| Ticket | Title | Completed |
|--------|-------|-----------|
| PTSPH-110 | Community settings entity | 2026-02-28 |
| PTSPH-111 | Server → Space rename (UI) | 2026-02-28 |
| PTSPH-112 | Space visibility & types | 2026-02-28 |
| PTSPH-113 | Community sidebar redesign | 2026-02-28 |
| PTSPH-114 | Community admin panel | 2026-02-28 |
| PTSPH-115 | Onboarding flow | 2026-02-28 |
| PTSPH-116 | Space access control | 2026-02-28 |

### M11 — Roles & Permissions Engine (2026-02-28)

| Ticket | Title | Completed |
|--------|-------|-----------|
| PTSPH-100 | Permission bitfield library | 2026-02-28 |
| PTSPH-101 | Missing channel_categories migration | 2026-02-28 |
| PTSPH-102 | Roles schema migration | 2026-02-28 |
| PTSPH-103 | Backend interface: roles | 2026-02-28 |
| PTSPH-104 | Roles store & composables | 2026-02-28 |
| PTSPH-105 | Migrate UI permission checks | 2026-02-28 |
| PTSPH-106 | Role management UI | 2026-02-28 |
| PTSPH-107 | RLS policies for permissions | 2026-02-28 |

### M10 — Feature Polish & Extension

| Ticket | Title | Completed |
|--------|-------|-----------|
| PTSPH-043 | Local Supabase dev setup | 2026-02-22 |
| PTSPH-044 | Fix join server dialog stuck state | 2026-02-22 |
| PTSPH-045 | Fix signup redirect + username passthrough | 2026-02-22 |
| PTSPH-046 | Fix server creation (auto-join owner + default channel) | 2026-02-22 |
| PTSPH-047 | Fix DM members RLS recursion | 2026-02-22 |

### M9.5 — Feature Polish & Context Menus

| Ticket | Title | Completed |
|--------|-------|-----------|
| PTSPH-035 | Toast notification system | 2026-02-21 |
| PTSPH-036 | Context menu system (messages, members, channels, server icons, DMs) | 2026-02-21 |
| PTSPH-037 | Message markdown rendering (bold, italic, code, strikethrough, links) | 2026-02-21 |
| PTSPH-038 | Member list sorting by role + status with group headers | 2026-02-21 |
| PTSPH-039 | Category collapse persistence (localStorage) | 2026-02-21 |
| PTSPH-040 | Channel description in header with hover tooltip | 2026-02-21 |
| PTSPH-041 | Unread improvements (DM badges, tab title, reply-as-mention) | 2026-02-21 |
| PTSPH-042 | Message search with highlight and scroll-to-message | 2026-02-21 |

### M9 — Moderation & Roles

| Ticket | Title | Completed |
|--------|-------|-----------|
| PTSPH-029 | Role-based permissions (owner/admin/moderator/member) | 2026-02-20 |
| PTSPH-030 | Member profile modal with role management | 2026-02-20 |
| PTSPH-031 | Kick & ban system with ban list in server settings | 2026-02-20 |

### M8 — Channel Polish

| Ticket | Title | Completed |
|--------|-------|-----------|
| PTSPH-026 | Channel categories (collapsible with animated chevrons) | 2026-02-20 |
| PTSPH-027 | Drag-and-drop channel reordering within categories | 2026-02-20 |
| PTSPH-028 | Slowmode enforcement with countdown timer | 2026-02-20 |

### M7 — Reactions & Pinning

| Ticket | Title | Completed |
|--------|-------|-----------|
| PTSPH-024 | Emoji reactions (quick picker, pill counts, toggle) | 2026-02-20 |
| PTSPH-025 | Pin messages (pin/unpin hover action, pinned panel in header) | 2026-02-20 |

### M6 — Mentions & Notifications

| Ticket | Title | Completed |
|--------|-------|-----------|
| PTSPH-021 | @mention parsing (renderWithMentions, HTML-safe, highlight self vs others) | 2026-02-20 |
| PTSPH-022 | Mention badge on server icon (red count badge, clears on open) | 2026-02-20 |
| PTSPH-023 | Browser notifications (Notification API, fires on @mention when unfocused) | 2026-02-20 |

### M5 — Direct Messages

| Ticket | Title | Completed |
|--------|-------|-----------|
| PTSPH-018 | DM backend (groups, messages, profiles.search — local + supabase) | 2026-02-20 |
| PTSPH-019 | DM conversation list (sidebar, new DM dialog with user search) | 2026-02-20 |
| PTSPH-020 | DM message view (full chat UI, edit/delete, other user profile panel) | 2026-02-20 |

### M4 — Presence, Typing & Unread

| Ticket | Title | Completed |
|--------|-------|-----------|
| PTSPH-015 | User presence (online/idle/offline, auto-idle, tab-close offline) | 2026-02-20 |
| PTSPH-016 | Typing indicators (cross-tab via localStorage StorageEvent) | 2026-02-20 |
| PTSPH-017 | Unread channel indicators (dot badge, mark-as-read on focus) | 2026-02-20 |

### M3 — Real-time Messaging

| Ticket | Title | Completed |
|--------|-------|-----------|
| PTSPH-012 | Message input + display (grouping, timestamps, auto-scroll) | 2026-02-20 |
| PTSPH-013 | Message editing/deletion (inline edit, owner moderation) | 2026-02-20 |
| PTSPH-014 | Reply system (reply bar, quoted preview, reply_to_id persisted) | 2026-02-20 |

### M2 — Server & Channel Management

| Ticket | Title | Completed |
|--------|-------|-----------|
| PTSPH-008 | Server CRUD (create/edit/delete, sidebar, settings) | 2026-02-20 |
| PTSPH-009 | Channel CRUD (create/delete, sidebar list, navigation) | 2026-02-20 |
| PTSPH-010 | Member system (join/leave, member list, roles) | 2026-02-20 |
| PTSPH-011 | Backend adapter extensions (servers, channels, members) | 2026-02-20 |

### M1 — Project Scaffold & Auth

| Ticket | Title | Completed |
|--------|-------|-----------|
| INIT-001 | ProtoGear Agent Framework | 2026-02-20 |
| INIT-002 | Architecture docs | 2026-02-20 |
| INIT-003 | Git repository | 2026-02-20 |
| PTSPH-001 | Project scaffold | 2026-02-20 |
| PTSPH-002 | Database schema & RLS policies | 2026-02-20 |
| PTSPH-003 | Auth flow (login, register, OAuth, route guards) | 2026-02-20 |
| PTSPH-004 | Profile system (composable, editor, avatar, presence) | 2026-02-20 |
| PTSPH-005 | Backend adapter layer (local + supabase) | 2026-02-20 |
| PTSPH-006 | UI polish (AppShell, DM home, local mode indicators) | 2026-02-20 |
| PTSPH-007 | Future ticket planning | 2026-02-20 |

## Key Files

```
src/lib/backend/
  types.ts              — AuthUser, AuthSession, Backend interface
  index.ts              — auto-detect mode, export singleton
  local.ts              — localStorage implementation
  supabase-backend.ts   — wraps Supabase client

src/composables/
  useAuth.ts            — login, register, OAuth, logout, password reset
  useProfile.ts         — fetch, update, avatar upload
  useServers.ts         — CRUD, join/leave, invite codes
  useChannels.ts        — CRUD, list by server
  useMembers.ts         — list, role updates
  useMessages.ts        — fetch, send, edit, delete, pin, unpin, fetchPinned
  useReactions.ts       — fetchReactionsForChannel, toggleReaction
  usePresence.ts        — online/idle/offline lifecycle
  useTyping.ts          — cross-tab typing state via StorageEvent
  useUnread.ts          — unread tracking, mark-as-read
  useDMs.ts             — DM groups, messages, user search
  useDmUnread.ts        — DM unread tracking (localStorage-based)
  useMessageSearch.ts   — Client-side message search composable
  useCategories.ts      — Channel category CRUD

src/stores/
  auth.ts               — user, session, isAuthenticated (backend-agnostic types)
  servers.ts, channels.ts, messages.ts, dms.ts, ui.ts, reactions.ts, mentions.ts
  categories.ts         — channel categories
  toast.ts              — global toast notification state
  contextMenu.ts        — context menu state (position, items, visibility)

src/pages/
  LoginPage.vue         — email/password form, OAuth (hidden in local mode)
  RegisterPage.vue      — registration form, auth watcher redirect
  DMPage.vue            — DM conversations + chat
  SettingsPage.vue      — profile editor (avatar, name, bio, status)
  ServerPage.vue        — channel sidebar, member list, server actions, message list + input
  ServerSettingsPage.vue — edit server name/description, ban list, delete
  InvitePage.vue        — join server via invite code

src/components/
  layout/AppShell.vue   — master layout: server sidebar + channel sidebar + content + member sidebar
  chat/EmojiPicker.vue  — emoji-mart wrapper, lazy-loaded
  chat/MessageSearch.vue — search input + results panel
  ui/ToastContainer.vue — global toasts
  ui/ContextMenu.vue    — right-click context menus
  ui/ConfirmDialog.vue  — confirmation modals
  user/UserAvatar.vue   — avatar + presence dot
  user/PresenceIndicator.vue — status dot
  server/CreateServerDialog.vue
  server/JoinServerDialog.vue

src/lib/
  supabase.ts           — conditional client (null if no env vars)
  types.ts              — TypeScript types matching DB schema
  markdown.ts           — markdown-to-HTML renderer
  mentions.ts           — renderMessage pipeline, mention extraction
  contextMenuItems.ts   — factory functions for context menu items

supabase/migrations/
  001_initial_schema.sql  — 11 tables with constraints
  002_rls_policies.sql    — RLS policies + helper functions
  003_profile_trigger.sql — auto-create profile on signup
  004_fix_profile_trigger.sql — read username from signup metadata
  005_fix_dm_members_rls.sql  — fix recursive RLS with security definer function
```

## Recent Updates

- 2026-03-05: M16 — Horizontal community top bar (PTSPH-147): `CommunitySidebar.vue` redesigned as full-width `h-12` `<header>`; community identity left, scrollable space nav middle, actions right. `AppShell.vue` switched to `flex-col`. Polls icon moved left of input field, emoji picker right. `dev:local` npm script added for localStorage-only development (no Docker required).
- 2026-02-28: Release fixes — ThreadPanel and DMPage now have real-time message subscriptions (startMessages/startDmMessages). DMPage typing wired to Realtime Broadcast in Supabase mode. Migration 019 adds `direct_messages` to supabase_realtime publication.
- 2026-02-28: M11–M15 complete. Roles & permissions, community identity, moderation, engagement features, Supabase real-time across all clients.
- 2026-02-22: Vision pivot — Protosphere becomes single-community platform. M11-M15 planned.
- 2026-02-22: PTSPH-043–047 — M10: local Supabase dev setup, join dialog fix, signup redirect, server creation auto-join + default channel, DM RLS fix.
- 2026-02-21: PTSPH-035–042 — M9.5: toast system, context menus, markdown, member sorting, category persistence, channel descriptions, DM unread, message search.
- 2026-02-20: M1–M9 complete. Full Discord-like feature set in local mode.

---
*Maintained by ProtoGear Agent Framework*
