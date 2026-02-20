# Project Specification: Unified Communication Platform

## Context

This is the kick-off specification for a web-based IRC/Discord-like communication platform. It serves a dual purpose:

1. **Standalone product** — A real-time chat platform with servers, channels, DMs, roles, and rich messaging
2. **Unified hub** — The central user management and authentication system for all future services (TypeScript course, future courses, web games, etc.)

Development starts from scratch in a new repository. The existing TypeScript learning platform will eventually integrate with this system for shared authentication and user profiles.

---

## Vision

A lightweight, fast, self-hostable communication platform where communities form around learning, building, and playing. Think Discord's UX clarity meets IRC's simplicity — no bloat, no Electron, just a modern web app.

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
| **Hosting** | netcup (static) | Frontend served as static files, unchanged from current setup |
| **Real-time** | Supabase Realtime | Phoenix/Elixir channels for WebSocket messaging |
| **Auth** | Supabase Auth | Email/password + OAuth (GitHub, Google) |
| **File Storage** | Supabase Storage | User uploads, avatars, attachments |

### Why Supabase

- All-in-one: DB + auth + realtime + storage — no separate services to manage
- PostgreSQL underneath — no vendor lock-in, standard SQL, self-hostable
- Realtime built on Elixir/Phoenix — best-in-class WebSocket infrastructure
- Row Level Security (RLS) — channel/server permissions enforced at DB level
- Becomes the single auth provider for all services (courses, games, etc.)
- Free tier sufficient to start (200 concurrent connections, 2M messages/month)
- Scale path: Free → Pro ($25/mo) → Self-hosted on netcup VPS

---

## Architecture Overview

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

#### `profiles` (extends `auth.users`)
```sql
id              UUID PRIMARY KEY REFERENCES auth.users(id)
username        TEXT UNIQUE NOT NULL        -- @handle, 3-32 chars, alphanumeric + underscores
display_name    TEXT NOT NULL               -- shown in chat, 1-48 chars
avatar_url      TEXT                        -- Supabase Storage path or null for default
status          TEXT DEFAULT 'offline'      -- online, idle, dnd, offline
status_text     TEXT DEFAULT ''             -- custom status message, max 128 chars
bio             TEXT DEFAULT ''             -- profile bio, max 500 chars
created_at      TIMESTAMPTZ DEFAULT now()
updated_at      TIMESTAMPTZ DEFAULT now()
```

#### `servers`
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
name            TEXT NOT NULL               -- 1-100 chars
description     TEXT DEFAULT ''             -- max 1000 chars
icon_url        TEXT                        -- server icon
owner_id        UUID REFERENCES profiles(id) NOT NULL
invite_code     TEXT UNIQUE                 -- shareable join code
is_public       BOOLEAN DEFAULT false       -- discoverable in server browser
member_count    INT DEFAULT 0               -- denormalized counter
created_at      TIMESTAMPTZ DEFAULT now()
```

#### `channels`
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
server_id       UUID REFERENCES servers(id) ON DELETE CASCADE NOT NULL
name            TEXT NOT NULL               -- lowercase, hyphens, 1-50 chars
description     TEXT DEFAULT ''
type            TEXT DEFAULT 'text'         -- text (voice reserved for future)
position        INT DEFAULT 0              -- sort order within server
is_default      BOOLEAN DEFAULT false       -- new members land here
slowmode_seconds INT DEFAULT 0             -- 0 = disabled
created_at      TIMESTAMPTZ DEFAULT now()
UNIQUE(server_id, name)
```

#### `messages`
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
channel_id      UUID REFERENCES channels(id) ON DELETE CASCADE NOT NULL
author_id       UUID REFERENCES profiles(id) NOT NULL
content         TEXT NOT NULL               -- markdown, max 4000 chars
edited_at       TIMESTAMPTZ                 -- null if never edited
reply_to_id     UUID REFERENCES messages(id) ON DELETE SET NULL
attachments     JSONB DEFAULT '[]'          -- [{url, filename, size, mime_type}]
is_pinned       BOOLEAN DEFAULT false
created_at      TIMESTAMPTZ DEFAULT now()
```
**Index**: `(channel_id, created_at DESC)` — primary query pattern

#### `direct_message_groups`
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
name            TEXT                        -- null for 1:1, optional for groups
is_group        BOOLEAN DEFAULT false
created_at      TIMESTAMPTZ DEFAULT now()
```

#### `direct_message_members`
```sql
dm_group_id     UUID REFERENCES direct_message_groups(id) ON DELETE CASCADE
user_id         UUID REFERENCES profiles(id) ON DELETE CASCADE
joined_at       TIMESTAMPTZ DEFAULT now()
PRIMARY KEY (dm_group_id, user_id)
```

#### `direct_messages`
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
dm_group_id     UUID REFERENCES direct_message_groups(id) ON DELETE CASCADE NOT NULL
author_id       UUID REFERENCES profiles(id) NOT NULL
content         TEXT NOT NULL
edited_at       TIMESTAMPTZ
attachments     JSONB DEFAULT '[]'
created_at      TIMESTAMPTZ DEFAULT now()
```

#### `members` (server membership + roles)
```sql
server_id       UUID REFERENCES servers(id) ON DELETE CASCADE
user_id         UUID REFERENCES profiles(id) ON DELETE CASCADE
role            TEXT DEFAULT 'member'       -- owner, admin, moderator, member
nickname        TEXT                        -- server-specific display name override
joined_at       TIMESTAMPTZ DEFAULT now()
PRIMARY KEY (server_id, user_id)
```

#### `reactions`
```sql
message_id      UUID REFERENCES messages(id) ON DELETE CASCADE
user_id         UUID REFERENCES profiles(id) ON DELETE CASCADE
emoji           TEXT NOT NULL               -- unicode emoji or custom emoji code
created_at      TIMESTAMPTZ DEFAULT now()
PRIMARY KEY (message_id, user_id, emoji)
```

#### `channel_read_state`
```sql
channel_id      UUID REFERENCES channels(id) ON DELETE CASCADE
user_id         UUID REFERENCES profiles(id) ON DELETE CASCADE
last_read_at    TIMESTAMPTZ DEFAULT now()   -- messages after this are "unread"
mention_count   INT DEFAULT 0
PRIMARY KEY (channel_id, user_id)
```

#### `bans`
```sql
server_id       UUID REFERENCES servers(id) ON DELETE CASCADE
user_id         UUID REFERENCES profiles(id) ON DELETE CASCADE
banned_by       UUID REFERENCES profiles(id) NOT NULL
reason          TEXT DEFAULT ''
created_at      TIMESTAMPTZ DEFAULT now()
PRIMARY KEY (server_id, user_id)
```

### Future Tables (not in MVP, reserved)
- `custom_emojis` — server-specific emoji uploads
- `webhooks` — external integrations
- `audit_log` — moderation actions
- `voice_sessions` — voice/video (future phase)
- `service_connections` — links to TypeScript course, future games, etc.

---

## Authentication & Unified Identity

### Auth Flow
1. User signs up via Supabase Auth (email/password or OAuth)
2. Database trigger creates `profiles` row with defaults
3. JWT issued, stored client-side
4. All API calls include JWT — Supabase RLS validates per-row

### OAuth Providers (MVP)
- **GitHub** — primary audience is developers
- **Google** — broad accessibility
- **Email/password** — always available as fallback

### Unified Identity Across Services
- Supabase project = single auth instance
- TypeScript course (and future services) share the same Supabase project
- Each service is a separate frontend (static SPA on different subdomain)
- All services read from the same `profiles` table
- Service-specific data lives in service-specific tables (e.g., `lesson_progress` for the course)

### TypeScript Course Migration Path
1. User creates account on communication platform
2. User visits TypeScript course → redirected to Supabase login (same account)
3. On first authenticated visit, course offers to import localStorage data
4. `ExportData` JSON (already implemented in course v1.0.1) uploads to Supabase tables
5. localStorage cleared, course now reads/writes from Supabase

---

## Real-time Architecture

### Supabase Realtime Channels

**Channel messages** — Postgres Changes (listen to INSERT on `messages` table, filtered by `channel_id`)
```
realtime:messages:channel_id=<uuid>
```

**Presence** — Supabase Presence (built-in, tracks who's in which channel)
```
realtime:presence:server_id=<uuid>
```

**Typing indicators** — Supabase Broadcast (ephemeral, no DB storage)
```
realtime:typing:channel_id=<uuid>
```

**DM messages** — Postgres Changes on `direct_messages`, filtered by `dm_group_id`

### Connection Strategy
- One WebSocket connection per Supabase client (multiplexed)
- Subscribe to channels on navigation (enter server → subscribe to all its channels)
- Unsubscribe on leave (prevents resource leaks)
- Reconnect with exponential backoff on disconnect

### Message Flow
1. User types message → INSERT into `messages` via Supabase client
2. RLS policy validates: user is member of server, not banned, channel permissions OK
3. Supabase Realtime broadcasts the new row to all subscribers of that channel
4. All connected clients receive the message in real-time
5. `channel_read_state` updated on the sender's side; recipients see unread indicator

---

## Feature Breakdown

### MVP Features (v1.0)

#### User System
- [x] Registration (email/password + GitHub + Google OAuth)
- [x] Login / logout / password reset
- [x] Profile editing (username, display name, avatar upload, bio, status text)
- [x] User presence (online/idle/DND/offline) — auto-idle after 5min inactivity
- [x] User profile popover (click username → see profile card)

#### Servers
- [x] Create server (name, description, icon)
- [x] Generate/regenerate invite code
- [x] Join server via invite code or public browser
- [x] Leave server
- [x] Edit server settings (owner/admin only)
- [x] Delete server (owner only, confirmation dialog)
- [x] Server member list (sidebar)

#### Channels
- [x] Create/edit/delete channels (admin+)
- [x] Reorder channels (drag & drop or position input)
- [x] Default channel (auto-selected on server join)
- [x] Channel description / topic
- [x] Slowmode (optional, per-channel cooldown)

#### Messaging
- [x] Send/receive text messages in real-time
- [x] Markdown rendering (bold, italic, code, code blocks, links, lists)
- [x] Edit own messages
- [x] Delete own messages (admin/mod can delete any)
- [x] Reply to messages (quoted reply with link to original)
- [x] Pin/unpin messages (mod+)
- [x] Emoji reactions on messages
- [x] @mention users (autocomplete, highlight, notification)
- [x] @everyone / @here mentions (mod+ only)
- [x] Message timestamps (relative + absolute on hover)
- [x] Message grouping (consecutive messages from same author collapse)
- [x] Auto-link URLs
- [x] Infinite scroll (load older messages on scroll up)

#### Direct Messages
- [x] 1:1 direct messages
- [x] Group DMs (up to 10 participants)
- [x] DM list in sidebar
- [x] Same features as channel messages (markdown, edit, delete, reactions)

#### File Sharing
- [x] Upload via button, drag & drop, or clipboard paste
- [x] Image preview inline (thumbnails for large images)
- [x] File attachment display (filename, size, download link)
- [x] Max file size: 10MB (Supabase Storage free tier)
- [x] Allowed types: images, documents, archives (no executables)

#### Unread & Notifications
- [x] Unread channel indicators (bold channel name + dot)
- [x] Mention badge count per channel
- [x] Mark channel as read (on navigation or manual)
- [x] Browser notifications for mentions and DMs (opt-in)

#### Roles & Permissions
- [x] Role hierarchy: Owner > Admin > Moderator > Member
- [x] Owner: full control, transfer ownership, delete server
- [x] Admin: manage channels, manage roles (below admin), manage members
- [x] Moderator: delete messages, mute/kick users, pin messages
- [x] Member: send messages, react, upload files
- [x] Per-channel permission overrides (future — keep schema flexible)

#### Moderation
- [x] Kick user from server
- [x] Ban user from server (with reason)
- [x] Unban user
- [x] Mute user (server-wide, timed or permanent)
- [x] Delete any message (mod+)
- [x] Slowmode per channel

#### Search
- [x] Full-text message search within server
- [x] Filter by channel, author, date range
- [x] Search results with context and jump-to-message

### Future Features (post-MVP)
- Voice/video channels (WebRTC)
- Custom emoji uploads per server
- Threads (reply chains within a channel)
- Webhooks & bot API
- Audit log for moderation actions
- Server discovery / public listing
- Server categories (channel groups)
- User blocking
- Message formatting toolbar (WYSIWYG toggle)
- Mobile app (Capacitor or PWA)

---

## UI Architecture

### Layout Structure

```
┌──────────────────────────────────────────────────────────┐
│  Top Bar (user avatar, search, settings, notifications)  │
├─────┬────────────┬───────────────────────────┬───────────┤
│     │            │                           │           │
│  S  │  Channel   │     Message Area          │  Member   │
│  e  │  List      │                           │  List     │
│  r  │            │  ┌─────────────────────┐  │           │
│  v  │  #general  │  │ Message 1           │  │  @user1   │
│  e  │  #help     │  │ Message 2           │  │  @user2   │
│  r  │  #random   │  │ Message 3           │  │  @user3   │
│     │            │  │ ...                 │  │           │
│  L  │  ────────  │  └─────────────────────┘  │           │
│  i  │  DMs       │                           │           │
│  s  │            │  ┌─────────────────────┐  │           │
│  t  │            │  │ Message Input       │  │           │
│     │            │  └─────────────────────┘  │           │
├─────┴────────────┴───────────────────────────┴───────────┤
│  Status Bar (connection status, typing indicators)        │
└──────────────────────────────────────────────────────────┘
```

- **Server list** (leftmost, narrow): Icons for each joined server + DMs + add server button
- **Channel list** (second column): Channels for active server, collapsible sections
- **Message area** (main): Scrollable message feed + input box with formatting
- **Member list** (right, collapsible): Online/offline members grouped by role
- **Top bar**: Search, user settings, notification bell
- **Responsive**: Sidebars collapse to overlays on mobile (same pattern as TypeScript course)

### Design System

Shared with TypeScript course via Tailwind `@theme` tokens:
- Dark theme (slate-950 bg, slate-50 text) — matches course aesthetic
- Same font stack (Inter/system)
- Consistent spacing, border-radius, color palette
- New tokens for presence colors (green=online, yellow=idle, red=DND, gray=offline)
- Server/channel accent colors

### Key Components

```
src/
├── components/
│   ├── layout/
│   │   ├── AppShell.vue              -- main layout wrapper
│   │   ├── ServerSidebar.vue         -- server icon list (leftmost)
│   │   ├── ChannelSidebar.vue        -- channel list + DMs
│   │   ├── MemberSidebar.vue         -- member list (right)
│   │   └── TopBar.vue                -- search, user menu, notifications
│   ├── chat/
│   │   ├── MessageList.vue           -- virtual-scrolled message feed
│   │   ├── MessageItem.vue           -- single message (with grouping)
│   │   ├── MessageInput.vue          -- input box with markdown, upload, emoji picker
│   │   ├── MessageReactions.vue      -- reaction display + picker
│   │   ├── ReplyPreview.vue          -- quoted reply above input
│   │   ├── TypingIndicator.vue       -- "user is typing..."
│   │   └── PinnedMessages.vue        -- pinned messages panel
│   ├── server/
│   │   ├── CreateServerDialog.vue
│   │   ├── ServerSettings.vue
│   │   ├── InviteDialog.vue
│   │   └── ServerBrowser.vue         -- discover public servers
│   ├── channel/
│   │   ├── CreateChannelDialog.vue
│   │   ├── ChannelSettings.vue
│   │   └── ChannelHeader.vue         -- name, topic, pinned, search, members toggle
│   ├── user/
│   │   ├── ProfileCard.vue           -- popover on username click
│   │   ├── ProfileEditor.vue         -- edit own profile
│   │   ├── UserAvatar.vue            -- avatar + presence dot
│   │   ├── PresenceIndicator.vue     -- colored dot
│   │   └── UserStatusBadge.vue
│   ├── dm/
│   │   ├── DMList.vue                -- DM conversations sidebar
│   │   ├── NewDMDialog.vue
│   │   └── DMGroupHeader.vue
│   ├── moderation/
│   │   ├── BanDialog.vue
│   │   ├── KickDialog.vue
│   │   └── MuteDialog.vue
│   └── ui/
│       ├── Dialog.vue                -- modal base component
│       ├── ContextMenu.vue           -- right-click menus
│       ├── Tooltip.vue
│       ├── EmojiPicker.vue
│       ├── FileUpload.vue
│       ├── SearchBar.vue
│       ├── Toast.vue                 -- notification toasts
│       └── ConfirmDialog.vue
├── composables/
│   ├── useAuth.ts                    -- login, logout, session, OAuth
│   ├── useProfile.ts                 -- user profile CRUD
│   ├── useServers.ts                 -- server CRUD + membership
│   ├── useChannels.ts                -- channel CRUD + navigation
│   ├── useMessages.ts                -- send, edit, delete, fetch, paginate
│   ├── useDirectMessages.ts          -- DM CRUD
│   ├── useRealtime.ts                -- Supabase channel subscriptions
│   ├── usePresence.ts                -- online status tracking
│   ├── useTyping.ts                  -- typing indicator broadcast
│   ├── useReactions.ts               -- add/remove reactions
│   ├── useFileUpload.ts              -- Supabase Storage uploads
│   ├── useSearch.ts                  -- full-text message search
│   ├── useUnread.ts                  -- read state + mention counts
│   ├── useModeration.ts              -- ban, kick, mute actions
│   ├── useNotifications.ts           -- browser notification API
│   └── usePermissions.ts             -- role checks, can(action, resource)
├── stores/                           -- Pinia stores
│   ├── auth.ts                       -- current user session
│   ├── servers.ts                    -- joined servers cache
│   ├── channels.ts                   -- channels per server cache
│   ├── messages.ts                   -- message cache (per channel, windowed)
│   └── ui.ts                         -- sidebar visibility, active panels
├── lib/
│   ├── supabase.ts                   -- Supabase client init
│   ├── markdown.ts                   -- markdown parser (lightweight, no heavy deps)
│   ├── permissions.ts                -- role hierarchy + permission definitions
│   ├── validators.ts                 -- input validation (username, channel name, etc.)
│   ├── formatters.ts                 -- date/time formatting, file size display
│   └── constants.ts                  -- limits, regex patterns, defaults
├── pages/
│   ├── LoginPage.vue
│   ├── RegisterPage.vue
│   ├── ServerPage.vue                -- main chat view (channel selected)
│   ├── DMPage.vue                    -- DM conversation view
│   ├── SettingsPage.vue              -- user settings
│   ├── ServerSettingsPage.vue
│   └── InvitePage.vue                -- /invite/:code landing
└── router.ts
```

### Routing

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

## Row Level Security (RLS) Policies

### Key Policies (simplified)

```sql
-- profiles: anyone can read, only own profile writable
CREATE POLICY "profiles_read" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = id);

-- messages: readable by server members, insertable by non-banned members
CREATE POLICY "messages_read" ON messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM members WHERE server_id = (
    SELECT server_id FROM channels WHERE id = messages.channel_id
  ) AND user_id = auth.uid())
);
CREATE POLICY "messages_insert" ON messages FOR INSERT WITH CHECK (
  auth.uid() = author_id AND
  EXISTS (SELECT 1 FROM members m WHERE m.server_id = (
    SELECT server_id FROM channels WHERE id = channel_id
  ) AND m.user_id = auth.uid()) AND
  NOT EXISTS (SELECT 1 FROM bans b WHERE b.server_id = (
    SELECT server_id FROM channels WHERE id = channel_id
  ) AND b.user_id = auth.uid())
);

-- members: join via invite, leave voluntarily
-- servers: owner can update/delete
-- channels: admin+ can create/update/delete
-- reactions: members can add/remove own
-- bans: mod+ can insert, admin+ can delete
```

---

## Scaling Strategy

| Stage | Users | Backend | Cost |
|-------|-------|---------|------|
| **Launch** | <50 concurrent | Supabase Free | $0/mo |
| **Growth** | 50-500 concurrent | Supabase Pro | $25/mo |
| **Scale** | 500+ concurrent | Self-hosted Supabase on netcup VPS | ~€10-20/mo VPS |

### Performance Considerations
- **Message pagination**: Load 50 messages at a time, infinite scroll up
- **Virtual scrolling**: Only render visible messages in DOM (vue-virtual-scroller or custom)
- **Message cache**: Pinia store holds last N messages per channel, evicts old channels
- **Presence batching**: Supabase Presence handles diffing — only changes broadcast
- **Image optimization**: Thumbnails generated client-side before upload, lazy loading
- **Connection pooling**: Single Supabase client, multiplexed channels

---

## Development Milestones

### M1: Project Scaffold & Auth (Week 1-2)
- Vite + Vue 3 + TypeScript + Tailwind 4 + Vue Router + Pinia
- Supabase project setup (database, auth config, storage buckets)
- Database schema migration (all tables + RLS policies)
- Login / Register pages (email + GitHub + Google OAuth)
- Profile creation trigger + profile editor
- Basic app shell layout (server sidebar, channel sidebar, main area)

### M2: Server & Channel Management (Week 3-4)
- Create / edit / delete servers
- Invite code generation + join flow
- Create / edit / delete / reorder channels
- Server member list
- Role assignment (owner promotes/demotes)
- Server settings page

### M3: Real-time Messaging (Week 5-6)
- Message sending + receiving via Supabase Realtime
- Markdown rendering
- Message editing + deletion
- Reply to messages
- Message grouping (consecutive from same author)
- Infinite scroll pagination (load older messages)
- Auto-link URLs

### M4: Presence, Typing & Unread (Week 7)
- User presence (online/idle/DND/offline)
- Auto-idle detection (5min inactivity)
- Typing indicators (broadcast channel)
- Unread channel indicators
- Mention detection + badge counts
- Mark as read on navigation

### M5: Rich Features (Week 8-9)
- Emoji reactions on messages
- @mention autocomplete
- Pin/unpin messages
- File upload (drag & drop, paste, button)
- Image preview + file attachment display
- Full-text search with filters

### M6: Direct Messages (Week 10)
- 1:1 DM creation + conversation view
- Group DMs (up to 10)
- DM list in sidebar
- DM notifications

### M7: Moderation & Permissions (Week 11)
- Kick / ban / unban users
- Mute users (timed + permanent)
- Message deletion by mods
- Slowmode per channel
- Permission checks throughout UI (hide/disable unauthorized actions)

### M8: Polish & Launch (Week 12)
- Responsive / mobile layout
- Browser notifications (opt-in)
- Keyboard shortcuts (Ctrl+K search, Esc close, etc.)
- Error handling + offline indicators + reconnection UX
- Loading states + skeleton screens
- Accessibility audit (ARIA, focus management, screen reader)
- Performance audit (bundle size, virtual scroll, lazy loading)
- Build + deploy pipeline

---

## Cross-Service Integration (Post-MVP)

### Shared Auth
- TypeScript course frontend swaps localStorage auth for Supabase Auth
- Same JWT, same user ID across all services
- Profile changes reflect everywhere

### Course ↔ Chat Integration
- Auto-create `#typescript-course` channel in a public learning server
- Course progress achievements post to chat (opt-in)
- Course-specific help channels (per tier)
- Link to specific lessons from chat messages

### Future Services
- Each new service (course, game) gets:
  - Its own static frontend on a subdomain
  - Its own tables in the shared Supabase project
  - Access to the same `profiles` + `auth.users`
  - Optional dedicated channels/server in the chat platform
