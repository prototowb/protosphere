# PROJECT STATUS - Unified Communication Platform

> **Single Source of Truth** for project state

## Current State

```yaml
project_phase: "M3 Complete"
protogear_enabled: true
framework: "Vue 3 + TypeScript + Supabase"
project_type: "Real-time Communication Platform"
initialization_date: "2026-02-20"
current_sprint: null
current_milestone: "M4 - Presence, Typing & Unread"
local_mode: true
```

## Architecture

```
composables → backend (interface) → local.ts | supabase-backend.ts
```

Backend adapter auto-detects mode via `VITE_SUPABASE_URL` env var. Local mode uses localStorage, Supabase mode wraps the real client. Composables are backend-agnostic.

## Active Tickets

### M3 — Real-time Messaging (local-first)

| Ticket | Title | Status | Description |
|--------|-------|--------|-------------|
| PTSPH-012 | Message input + display | Done | Send messages in channels, message list, message grouping, timestamps |
| PTSPH-013 | Message editing/deletion | Done | Edit own messages, delete own (owner can delete any) |
| PTSPH-014 | Reply system | Done | Reply to messages, reply bar above input, quoted preview in message |

### M4 — Presence, Typing & Unread

| Ticket | Title | Status | Description |
|--------|-------|--------|-------------|
| PTSPH-015 | User presence | Not Started | Online/idle/DND/offline, auto-idle after 5min inactivity |
| PTSPH-016 | Typing indicators | Not Started | Broadcast typing state, "user is typing..." display |
| PTSPH-017 | Unread indicators | Not Started | Unread channel markers, mention badge counts, mark-as-read |

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
  useMessages.ts        — fetch, send, edit, delete

src/stores/
  auth.ts               — user, session, isAuthenticated (backend-agnostic types)
  servers.ts, channels.ts, messages.ts, ui.ts

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

## Recent Updates

- 2026-02-20: PTSPH-012/013/014 — Full messaging: send/receive, grouping, inline edit, delete, reply system.
- 2026-02-20: PTSPH-008/009/010/011 — Server & channel CRUD, member system, backend adapter extensions. Full server management in local mode.
- 2026-02-20: PTSPH-005/006/007 — Backend adapter, UI polish, future planning. App now works locally without Supabase.
- 2026-02-20: PTSPH-002/003/004 — Database schema, auth flow, profile system
- 2026-02-20: PTSPH-001 — Project scaffold complete
- 2026-02-20: Project initialized with ProtoGear framework

---
*Maintained by ProtoGear Agent Framework*
