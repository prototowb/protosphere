# PROJECT STATUS - Protosphere Community Platform

> **Single Source of Truth** for project state

## Current State

```yaml
project_phase: "M10 Complete — Pivoting to Single-Community Architecture"
protogear_enabled: true
framework: "Vue 3 + TypeScript 5.9 + Vite 7 + Tailwind CSS 4 + Pinia + Supabase"
project_type: "Single-Community Communication Platform"
initialization_date: "2026-02-20"
current_milestone: "M11 — Roles & Permissions Engine"
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

### M11 — Roles & Permissions Engine

**Goal:** Replace hardcoded `owner > admin > moderator > member` with flexible custom roles + permission bitfields.

| Ticket | Title | Status | Description |
|--------|-------|--------|-------------|
| PTSPH-100 | Permission bitfield library | Not Started | `src/lib/permissions.ts`: Permission constants, `hasPermission()`, `computePermissions()`, preset templates |
| PTSPH-101 | Missing channel_categories migration | Not Started | `006_channel_categories.sql` — table exists in code but has no Supabase migration |
| PTSPH-102 | Roles schema migration | Not Started | `007_roles_permissions.sql`: `roles`, `user_roles`, `channel_role_overrides` tables + data migration from `members.role` |
| PTSPH-103 | Backend interface: roles | Not Started | Add `roles` namespace to `Backend` interface; implement in both `local.ts` and `supabase-backend.ts` |
| PTSPH-104 | Roles store & composables | Not Started | `stores/roles.ts`, `composables/useRoles.ts`, `composables/usePermissions.ts` with `can(permission)` |
| PTSPH-105 | Migrate UI permission checks | Not Started | Replace all hardcoded `myRole ===` patterns with `can(Permission.X)` in ServerPage, AppShell, contextMenuItems |
| PTSPH-106 | Role management UI | Not Started | Roles tab in space settings: CRUD, drag-to-reorder, permission checkboxes, color picker; multi-role member assignment |
| PTSPH-107 | RLS policies for permissions | Not Started | `008_rls_roles.sql`: `user_has_permission()` function, rewrite RLS policies |

### M12 — Spaces & Community Identity

**Goal:** Reframe app as single community with spaces. Add branding, visibility controls, onboarding.

| Ticket | Title | Status | Description |
|--------|-------|--------|-------------|
| PTSPH-110 | Community settings entity | Not Started | `community_settings` table, migration, types, backend `community` namespace, store, composable |
| PTSPH-111 | Server → Space rename (UI) | Not Started | Rename "Server" to "Space" in all UI. Route paths → `/spaces/:spaceId/:channelId`. Router aliases for compat |
| PTSPH-112 | Space visibility & types | Not Started | `visibility` (public/private/restricted) + `space_type` (general/announcement/archive) columns on servers |
| PTSPH-113 | Community sidebar redesign | Not Started | Replace server icon sidebar with community-branded header + categorized space list |
| PTSPH-114 | Community admin panel | Not Started | `CommunitySettingsPage.vue`: edit name, logo, banner, registration mode, rules, welcome message |
| PTSPH-115 | Onboarding flow | Not Started | Landing page, welcome screen, rules acceptance, registration approval mode |
| PTSPH-116 | Space access control | Not Started | Private/restricted space visibility + join gating by role |

### M13 — Moderation & Safety

**Goal:** Audit logging, reporting, mod queue, mutes, auto-moderation.

| Ticket | Title | Status | Description |
|--------|-------|--------|-------------|
| PTSPH-120 | Audit log infrastructure | Not Started | `audit_log` table, types, backend namespace, helper utility |
| PTSPH-121 | Wire moderation to audit log | Not Started | Wrap kick/ban/unban/role-change/channel-CRUD/message-delete with audit entries |
| PTSPH-122 | Audit log viewer | Not Started | `AuditLogViewer.vue` in space settings, paginated, filterable |
| PTSPH-123 | Report system | Not Started | `reports` table, "Report" in context menus, report dialog with categories |
| PTSPH-124 | Mod queue | Not Started | `ModQueuePage.vue`: pending reports, context, resolve/dismiss/warn/mute/kick/ban |
| PTSPH-125 | Mute system | Not Started | `mutes` table, "Mute" in member context menu, optional duration, auto-unmute |
| PTSPH-126 | Auto-moderation | Not Started | `automod_rules` table, `automod.ts`: word filter, spam detection, config UI |

### M14 — Engagement Features

**Goal:** Threads, polls, events, announcement spaces.

| Ticket | Title | Status | Description |
|--------|-------|--------|-------------|
| PTSPH-130 | Thread data model & backend | Not Started | `parent_message_id` + `is_thread` on channels; `threads.create()`, `threads.listByChannel()` |
| PTSPH-131 | Thread UI | Not Started | "Create Thread" on messages, thread panel, reuse message list |
| PTSPH-132 | Poll data model & backend | Not Started | `polls`, `poll_options`, `poll_votes` tables; `polls.create()`, `polls.vote()`, `polls.getResults()` |
| PTSPH-133 | Poll UI | Not Started | Poll creation dialog, progress bar embed in messages, close action |
| PTSPH-134 | Announcement spaces | Not Started | `space_type === 'announcement'`: only `MANAGE_MESSAGES` users can post |
| PTSPH-135 | Events system | Not Started | `events`, `event_rsvps` tables; event creation, list, RSVP |

### M15 — Supabase Real-time & Integration

**Goal:** Complete Supabase backend, real-time across clients, production-ready.

| Ticket | Title | Status | Description |
|--------|-------|--------|-------------|
| PTSPH-140 | Supabase migration validation | Not Started | Validate all M11-M14 migrations against real Supabase instance |
| PTSPH-141 | RLS policies for all new tables | Not Started | Write RLS for all new tables from M11-M14 |
| PTSPH-142 | Supabase backend: new namespaces | Not Started | Implement roles, community, auditLog, reports, mutes, threads, polls, events in supabase-backend.ts |
| PTSPH-143 | Real-time messages | Not Started | Supabase Realtime subscriptions for message INSERT/UPDATE/DELETE |
| PTSPH-144 | Real-time presence | Not Started | Replace localStorage presence with Supabase Realtime Presence |
| PTSPH-145 | Real-time typing | Not Started | Replace localStorage StorageEvent typing with Supabase Realtime Broadcast |
| PTSPH-146 | End-to-end testing | Not Started | Full feature testing against Supabase, RLS verification |

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

- 2026-02-22: Vision pivot — Protosphere becomes single-community platform. M11-M15 planned.
- 2026-02-22: PTSPH-043–047 — M10: local Supabase dev setup, join dialog fix, signup redirect, server creation auto-join + default channel, DM RLS fix.
- 2026-02-21: PTSPH-035–042 — M9.5: toast system, context menus, markdown, member sorting, category persistence, channel descriptions, DM unread, message search.
- 2026-02-20: M1–M9 complete. Full Discord-like feature set in local mode.

---
*Maintained by ProtoGear Agent Framework*
