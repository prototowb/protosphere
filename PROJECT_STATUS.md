# PROJECT STATUS - Unified Communication Platform

> **Single Source of Truth** for project state

## Current State

```yaml
project_phase: "M7 Complete"
protogear_enabled: true
framework: "Vue 3 + TypeScript + Supabase"
project_type: "Real-time Communication Platform"
initialization_date: "2026-02-20"
current_sprint: null
current_milestone: "M8 - Channel Polish"
local_mode: true
```

## Architecture

```
composables → backend (interface) → local.ts | supabase-backend.ts
```

Backend adapter auto-detects mode via `VITE_SUPABASE_URL` env var. Local mode uses localStorage, Supabase mode wraps the real client. Composables are backend-agnostic.

## Active Tickets

### M7 — Reactions & Pinning (local-first)

| Ticket | Title | Status | Description |
|--------|-------|--------|-------------|
| PTSPH-024 | Emoji reactions | Complete | Add/remove emoji reactions on messages, reaction pill counts, `reactions` table |
| PTSPH-025 | Pin messages | Complete | Pin messages in a channel, pinned messages panel from channel header |

### M8 — Channel Polish (local-first)

| Ticket | Title | Status | Description |
|--------|-------|--------|-------------|
| PTSPH-026 | Channel categories | Not Started | Group channels under collapsible category headers |
| PTSPH-027 | Channel reordering | Not Started | Drag-and-drop to reorder channels within a category |
| PTSPH-028 | Slowmode enforcement | Not Started | Enforce `slowmode_seconds` in the input — countdown timer on send button |

### M9 — Moderation & Roles (local-first)

| Ticket | Title | Status | Description |
|--------|-------|--------|-------------|
| PTSPH-029 | Role-based permissions | Not Started | Enforce channel create/delete and message moderation by member role |
| PTSPH-030 | Member context menu | Not Started | Click member to view profile, change role, kick |
| PTSPH-031 | Kick & ban | Not Started | Owner/admin can kick or ban users; ban check on join via invite |

### M10 — Supabase Integration (post-MVP)

| Ticket | Title | Status | Description |
|--------|-------|--------|-------------|
| PTSPH-032 | Supabase end-to-end validation | Not Started | Test all backend operations against a real Supabase instance |
| PTSPH-033 | Real-time message subscriptions | Not Started | Supabase Realtime for live cross-browser message delivery |
| PTSPH-034 | Real-time presence via Supabase | Not Started | Replace localStorage presence with Supabase Realtime presence |

## Completed Tickets

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

### M2 — Server & Channel Management

| Ticket | Title | Completed |
|--------|-------|-----------|
| PTSPH-008 | Server CRUD (create/edit/delete, sidebar, settings) | 2026-02-20 |
| PTSPH-009 | Channel CRUD (create/delete, sidebar list, navigation) | 2026-02-20 |
| PTSPH-010 | Member system (join/leave, member list, roles) | 2026-02-20 |
| PTSPH-011 | Backend adapter extensions (servers, channels, members) | 2026-02-20 |

### M3 — Real-time Messaging

| Ticket | Title | Completed |
|--------|-------|-----------|
| PTSPH-012 | Message input + display (grouping, timestamps, auto-scroll) | 2026-02-20 |
| PTSPH-013 | Message editing/deletion (inline edit, owner moderation) | 2026-02-20 |
| PTSPH-014 | Reply system (reply bar, quoted preview, reply_to_id persisted) | 2026-02-20 |

### M4 — Presence, Typing & Unread

| Ticket | Title | Completed |
|--------|-------|-----------|
| PTSPH-015 | User presence (online/idle/offline, auto-idle, tab-close offline) | 2026-02-20 |
| PTSPH-016 | Typing indicators (cross-tab via localStorage StorageEvent) | 2026-02-20 |
| PTSPH-017 | Unread channel indicators (dot badge, mark-as-read on focus) | 2026-02-20 |

### M5 — Direct Messages

| Ticket | Title | Completed |
|--------|-------|-----------|
| PTSPH-018 | DM backend (groups, messages, profiles.search — local + supabase) | 2026-02-20 |
| PTSPH-019 | DM conversation list (sidebar, new DM dialog with user search) | 2026-02-20 |
| PTSPH-020 | DM message view (full chat UI, edit/delete, other user profile panel) | 2026-02-20 |

### M6 — Mentions & Notifications

| Ticket | Title | Completed |
|--------|-------|-----------|
| PTSPH-021 | @mention parsing (renderWithMentions, HTML-safe, highlight self vs others) | 2026-02-20 |
| PTSPH-022 | Mention badge on server icon (red count badge, clears on open) | 2026-02-20 |
| PTSPH-023 | Browser notifications (Notification API, fires on @mention when unfocused) | 2026-02-20 |

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

src/stores/
  auth.ts               — user, session, isAuthenticated (backend-agnostic types)
  servers.ts, channels.ts, messages.ts, dms.ts, ui.ts, reactions.ts, mentions.ts

src/pages/
  LoginPage.vue         — email/password form, OAuth (hidden in local mode)
  RegisterPage.vue      — registration form, auto-login in local mode
  DMPage.vue            — welcome screen with AppShell
  SettingsPage.vue      — profile editor (avatar, name, bio, status)
  ServerPage.vue        — channel sidebar, member list, server actions, message list + input
  ServerSettingsPage.vue — edit server name/description, delete
  InvitePage.vue        — join server via invite code

src/components/server/
  CreateServerDialog.vue — modal for creating new servers
  JoinServerDialog.vue   — modal for joining via invite code

src/lib/
  supabase.ts           — conditional client (null if no env vars)
  types.ts              — TypeScript types matching DB schema

supabase/migrations/
  001_initial_schema.sql — 11 tables with constraints
  002_rls_policies.sql   — RLS policies + helper functions
  003_profile_trigger.sql — auto-create profile on signup
```

## Completed Tickets (continued)

### M7 — Reactions & Pinning

| Ticket | Title | Completed |
|--------|-------|-----------|
| PTSPH-024 | Emoji reactions (quick picker, pill counts, toggle) | 2026-02-20 |
| PTSPH-025 | Pin messages (pin/unpin hover action, pinned panel in header) | 2026-02-20 |

## Recent Updates

- 2026-02-20: PTSPH-024/025 — M7: emoji reactions with quick picker + pill counts, message pinning with pinned panel.
- 2026-02-20: PTSPH-021/022/023 — M6: @mention highlighting, server badge counts, browser notifications.
- 2026-02-20: PTSPH-018/019/020 — M5: full DM system (conversation list, user search, message view with edit/delete).
- 2026-02-20: PTSPH-015/016/017 — M4: presence (idle/offline), typing indicators (cross-tab), unread channel dots.
- 2026-02-20: PTSPH-012/013/014 — Full messaging: send/receive, grouping, inline edit, delete, reply system.
- 2026-02-20: PTSPH-008/009/010/011 — Server & channel CRUD, member system, backend adapter extensions. Full server management in local mode.
- 2026-02-20: PTSPH-005/006/007 — Backend adapter, UI polish, future planning. App now works locally without Supabase.
- 2026-02-20: PTSPH-002/003/004 — Database schema, auth flow, profile system
- 2026-02-20: PTSPH-001 — Project scaffold complete
- 2026-02-20: Project initialized with ProtoGear framework

---
*Maintained by ProtoGear Agent Framework*
