# Project Architecture — Unified Communication Platform

> **Authoritative architecture reference** — extracted from `PROJECT_SPECIFICATIONS.md`
> This file supersedes any generic `ARCHITECTURE.md` template.

---

## Vision

A lightweight, fast, self-hostable communication platform (Discord UX clarity meets IRC simplicity). No bloat, no Electron — a modern web SPA. Also serves as the **unified identity hub** for all future services (TypeScript course, web games, etc.).

---

## Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Frontend** | Vue 3 + TypeScript 5.x | Preferred stack, shared with TypeScript course |
| **Build** | Vite 7 | Fast dev server, optimized builds |
| **Styling** | Tailwind CSS 4 | `@theme` design tokens, consistent with course |
| **Routing** | Vue Router 4 | SPA with nested layouts |
| **State** | Pinia | Server/channel/message state management |
| **Backend** | Supabase | PostgreSQL + Realtime + Auth + Storage + Edge Functions |
| **Hosting** | netcup (static) | Frontend served as static files |
| **Real-time** | Supabase Realtime | Phoenix/Elixir channels for WebSocket messaging |
| **Auth** | Supabase Auth | Email/password + OAuth (GitHub, Google) |
| **File Storage** | Supabase Storage | User uploads, avatars, attachments |

### Why Supabase

- All-in-one: DB + auth + realtime + storage — no separate services
- PostgreSQL underneath — no vendor lock-in, standard SQL, self-hostable
- Realtime built on Elixir/Phoenix — best-in-class WebSocket infrastructure
- Row Level Security (RLS) — permissions enforced at DB level
- Single auth provider for all services
- Free tier sufficient to start; scale path: Free → Pro ($25/mo) → Self-hosted on netcup VPS

---

## System Architecture

```
┌─────────────────────────────────────────────────┐
│                   netcup                        │
│           Static Frontend (Vue SPA)             │
│         chat.domain.com / hub.domain.com        │
└──────────────────┬──────────────────────────────┘
                   │ HTTPS
┌──────────────────▼──────────────────────────────┐
│                 Supabase                        │
│  ┌───────────┐ ┌──────────┐ ┌───────────────┐  │
│  │   Auth    │ │ Realtime │ │   Storage      │  │
│  │  (login,  │ │ (Phoenix │ │  (avatars,     │  │
│  │  OAuth,   │ │  channels│ │   attachments) │  │
│  │  sessions)│ │  for WS) │ │               │  │
│  └───────────┘ └──────────┘ └───────────────┘  │
│  ┌───────────────────────┐ ┌─────────────────┐  │
│  │     PostgreSQL        │ │ Edge Functions  │  │
│  │  (all data, RLS       │ │ (webhooks,      │  │
│  │   policies for        │ │  moderation,    │  │
│  │   permissions)        │ │  integrations)  │  │
│  └───────────────────────┘ └─────────────────┘  │
└─────────────────────────────────────────────────┘
```

**Key principle**: The frontend is a static SPA that talks directly to Supabase. No custom backend server. All business logic is enforced via RLS policies and Edge Functions.

---

## Data Model

### Core Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `profiles` | User profiles (extends `auth.users`) | username, display_name, avatar_url, status, bio |
| `servers` | Chat servers | name, owner_id, invite_code, is_public |
| `channels` | Text channels within servers | server_id, name, type, position, is_default, slowmode_seconds |
| `messages` | Channel messages | channel_id, author_id, content (markdown), reply_to_id, attachments (JSONB) |
| `members` | Server membership + roles | server_id, user_id, role (owner/admin/moderator/member) |
| `reactions` | Emoji reactions on messages | message_id, user_id, emoji |
| `channel_read_state` | Unread tracking | channel_id, user_id, last_read_at, mention_count |
| `direct_message_groups` | DM conversations | name, is_group |
| `direct_message_members` | DM group membership | dm_group_id, user_id |
| `direct_messages` | DM messages | dm_group_id, author_id, content |
| `bans` | Server bans | server_id, user_id, banned_by, reason |

### Key Index

- `messages(channel_id, created_at DESC)` — primary query pattern

### Reserved for Future

- `custom_emojis`, `webhooks`, `audit_log`, `voice_sessions`, `service_connections`

---

## Authentication & Unified Identity

### Auth Flow

1. User signs up via Supabase Auth (email/password or OAuth)
2. Database trigger creates `profiles` row with defaults
3. JWT issued, stored client-side
4. All API calls include JWT — Supabase RLS validates per-row

### OAuth Providers (MVP)

- GitHub (primary audience: developers)
- Google (broad accessibility)
- Email/password (fallback)

### Unified Identity Across Services

- Single Supabase project = single auth instance
- Each service is a separate frontend SPA on different subdomain
- All services read from the same `profiles` table
- Service-specific data lives in service-specific tables

### TypeScript Course Migration Path

1. User creates account on communication platform
2. User visits TypeScript course → redirected to Supabase login (same account)
3. On first authenticated visit, course offers to import localStorage data
4. `ExportData` JSON uploads to Supabase tables
5. localStorage cleared, course reads/writes from Supabase

---

## Real-time Architecture

### Supabase Realtime Channels

| Purpose | Mechanism | Pattern |
|---------|-----------|---------|
| Channel messages | Postgres Changes (INSERT on `messages`, filtered by `channel_id`) | `realtime:messages:channel_id=<uuid>` |
| Presence | Supabase Presence (tracks who's in which server) | `realtime:presence:server_id=<uuid>` |
| Typing indicators | Supabase Broadcast (ephemeral, no DB) | `realtime:typing:channel_id=<uuid>` |
| DM messages | Postgres Changes on `direct_messages`, filtered by `dm_group_id` | — |

### Connection Strategy

- One WebSocket connection per Supabase client (multiplexed)
- Subscribe to channels on navigation (enter server → subscribe to all its channels)
- Unsubscribe on leave (prevents resource leaks)
- Reconnect with exponential backoff on disconnect

### Message Flow

1. User types message → INSERT into `messages` via Supabase client
2. RLS policy validates: user is member, not banned, channel permissions OK
3. Supabase Realtime broadcasts new row to all subscribers
4. All connected clients receive the message in real-time
5. `channel_read_state` updated on sender side; recipients see unread indicator

---

## Row Level Security (RLS)

### Policy Summary

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| `profiles` | Anyone | Via auth trigger | Own profile only | — |
| `messages` | Server members | Non-banned members (own author_id) | Own messages | Own or mod+ |
| `members` | Server members | Via invite flow | Role changes (admin+) | Leave or admin+ |
| `servers` | Public or members | Authenticated | Owner only | Owner only |
| `channels` | Server members | Admin+ | Admin+ | Admin+ |
| `reactions` | Server members | Members (own) | — | Own only |
| `bans` | Mod+ | Mod+ | — | Admin+ |

---

## UI Architecture

### Layout Structure

```
┌──────────────────────────────────────────────────────────┐
│  Top Bar (user avatar, search, settings, notifications)  │
├─────┬────────────┬───────────────────────────┬───────────┤
│  S  │  Channel   │     Message Area          │  Member   │
│  e  │  List      │                           │  List     │
│  r  │            │                           │           │
│  v  │  #general  │  Messages...              │  @user1   │
│  e  │  #help     │                           │  @user2   │
│  r  │  #random   │                           │  @user3   │
│     │            │                           │           │
│  L  │  ────────  │  ┌─────────────────────┐  │           │
│  i  │  DMs       │  │ Message Input       │  │           │
│  s  │            │  └─────────────────────┘  │           │
│  t  │            │                           │           │
├─────┴────────────┴───────────────────────────┴───────────┤
│  Status Bar (connection status, typing indicators)        │
└──────────────────────────────────────────────────────────┘
```

- **Server list** (leftmost, narrow): Icons for each joined server + DMs + add server
- **Channel list** (second column): Channels for active server, collapsible
- **Message area** (main): Scrollable message feed + input with formatting
- **Member list** (right, collapsible): Online/offline grouped by role
- **Top bar**: Search, user settings, notification bell
- **Responsive**: Sidebars collapse to overlays on mobile

### Design System

- Dark theme (slate-950 bg, slate-50 text)
- Shared Tailwind `@theme` tokens with TypeScript course
- Same font stack (Inter/system)
- Presence colors: green=online, yellow=idle, red=DND, gray=offline

---

## Directory Structure

```
src/
├── components/
│   ├── layout/          -- AppShell, ServerSidebar, ChannelSidebar, MemberSidebar, TopBar
│   ├── chat/            -- MessageList, MessageItem, MessageInput, Reactions, ReplyPreview, TypingIndicator, PinnedMessages
│   ├── server/          -- CreateServerDialog, ServerSettings, InviteDialog, ServerBrowser
│   ├── channel/         -- CreateChannelDialog, ChannelSettings, ChannelHeader
│   ├── user/            -- ProfileCard, ProfileEditor, UserAvatar, PresenceIndicator
│   ├── dm/              -- DMList, NewDMDialog, DMGroupHeader
│   ├── moderation/      -- BanDialog, KickDialog, MuteDialog
│   └── ui/              -- Dialog, ContextMenu, Tooltip, EmojiPicker, FileUpload, SearchBar, Toast, ConfirmDialog
├── composables/         -- useAuth, useProfile, useServers, useChannels, useMessages, useDirectMessages,
│                           useRealtime, usePresence, useTyping, useReactions, useFileUpload,
│                           useSearch, useUnread, useModeration, useNotifications, usePermissions
├── stores/              -- auth, servers, channels, messages, ui (Pinia)
├── lib/                 -- supabase client, markdown parser, permissions, validators, formatters, constants
├── pages/               -- Login, Register, Server, DM, Settings, ServerSettings, Invite
└── router.ts
```

---

## Routing

```
/login                              -- login page
/register                           -- registration page
/channels/@me                       -- DM list (home)
/channels/@me/:dmGroupId            -- DM conversation
/channels/:serverId/:channelId      -- server channel view
/settings                           -- user settings
/settings/profile                   -- profile editor
/servers/:serverId/settings         -- server settings (owner/admin)
/invite/:code                       -- join server via invite
```

---

## Role & Permission Hierarchy

```
Owner > Admin > Moderator > Member
```

| Role | Capabilities |
|------|-------------|
| **Owner** | Full control, transfer ownership, delete server |
| **Admin** | Manage channels, manage roles (below admin), manage members |
| **Moderator** | Delete messages, mute/kick users, pin messages |
| **Member** | Send messages, react, upload files |

Per-channel permission overrides reserved for future (schema kept flexible).

---

## Scaling Strategy

| Stage | Users | Backend | Cost |
|-------|-------|---------|------|
| Launch | <50 concurrent | Supabase Free | $0/mo |
| Growth | 50-500 concurrent | Supabase Pro | $25/mo |
| Scale | 500+ concurrent | Self-hosted Supabase on netcup VPS | ~€10-20/mo |

### Performance Patterns

- **Message pagination**: 50 messages at a time, infinite scroll up
- **Virtual scrolling**: Only render visible messages in DOM
- **Message cache**: Pinia store holds last N messages per channel, evicts old channels
- **Presence batching**: Supabase Presence handles diffing — only changes broadcast
- **Image optimization**: Client-side thumbnails before upload, lazy loading
- **Connection pooling**: Single Supabase client, multiplexed channels

---

## Development Milestones

| Milestone | Focus | Timeframe |
|-----------|-------|-----------|
| M1 | Project scaffold & auth | Week 1-2 |
| M2 | Server & channel management | Week 3-4 |
| M3 | Real-time messaging | Week 5-6 |
| M4 | Presence, typing & unread | Week 7 |
| M5 | Rich features (reactions, mentions, pins, uploads, search) | Week 8-9 |
| M6 | Direct messages | Week 10 |
| M7 | Moderation & permissions | Week 11 |
| M8 | Polish & launch | Week 12 |

---

## Cross-Service Integration (Post-MVP)

- TypeScript course frontend swaps localStorage auth for Supabase Auth
- Same JWT / user ID across all services
- Auto-create `#typescript-course` channel in a public learning server
- Course progress achievements post to chat (opt-in)
- Each new service gets: own static frontend on subdomain, own tables in shared Supabase project, access to same `profiles` + `auth.users`

---

*Extracted from PROJECT_SPECIFICATIONS.md — Proto Gear Architecture Document*
