# Project Specification: Protosphere Community Platform

## Context

Protosphere is the central communication platform for a single online community. Originally scaffolded as a multi-server Discord clone (M1-M9.5), the project is pivoting to serve a **hybrid community model**: public-facing spaces for broad participation, private spaces for trusted members, and graduated access through custom roles with granular permissions.

It also serves as the **unified authentication hub** for all future services (TypeScript course, web games, etc.).

---

## Vision

The central hub for a single online community — not a Discord clone. Protosphere provides **spaces** (sub-communities) within one shared identity, a **custom role system** with granular permissions, community **branding and onboarding**, robust **moderation tools**, and **engagement features** like threads, polls, and events. Lightweight, fast, self-hostable — no bloat, no Electron, just a modern web app.

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

#### `community_settings` (single-row, instance identity)
```sql
id                UUID PRIMARY KEY DEFAULT gen_random_uuid()
name              TEXT NOT NULL DEFAULT 'My Community'
description       TEXT NOT NULL DEFAULT ''
logo_url          TEXT
banner_url        TEXT
registration_mode TEXT NOT NULL DEFAULT 'open'   -- open, approval, invite_only, closed
rules             TEXT NOT NULL DEFAULT ''
welcome_message   TEXT NOT NULL DEFAULT ''
created_at        TIMESTAMPTZ DEFAULT now()
updated_at        TIMESTAMPTZ DEFAULT now()
```

#### `roles` (per-space custom roles)
```sql
id            UUID PRIMARY KEY DEFAULT gen_random_uuid()
server_id     UUID REFERENCES servers(id) ON DELETE CASCADE NOT NULL
name          TEXT NOT NULL                -- 1-50 chars
color         TEXT                         -- hex, e.g. '#5865F2'
icon          TEXT                         -- emoji or icon identifier
position      INT NOT NULL DEFAULT 0       -- lower = higher priority
permissions   BIGINT NOT NULL DEFAULT 0    -- bitfield
is_default    BOOLEAN NOT NULL DEFAULT false
is_system     BOOLEAN NOT NULL DEFAULT false
created_at    TIMESTAMPTZ DEFAULT now()
UNIQUE(server_id, name)
```

#### `user_roles` (many-to-many role assignment)
```sql
user_id       UUID REFERENCES profiles(id) ON DELETE CASCADE
role_id       UUID REFERENCES roles(id) ON DELETE CASCADE
assigned_at   TIMESTAMPTZ DEFAULT now()
PRIMARY KEY (user_id, role_id)
```

#### `channel_role_overrides` (per-channel permission tweaks)
```sql
channel_id    UUID REFERENCES channels(id) ON DELETE CASCADE
role_id       UUID REFERENCES roles(id) ON DELETE CASCADE
allow         BIGINT NOT NULL DEFAULT 0    -- permissions explicitly allowed
deny          BIGINT NOT NULL DEFAULT 0    -- permissions explicitly denied
PRIMARY KEY (channel_id, role_id)
```

#### `audit_log` (immutable moderation record)
```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
server_id   UUID REFERENCES servers(id) ON DELETE SET NULL
actor_id    UUID REFERENCES profiles(id) NOT NULL
action      TEXT NOT NULL                  -- 'member.kick', 'message.delete', etc.
target_type TEXT NOT NULL                  -- 'member', 'message', 'channel', 'role'
target_id   TEXT NOT NULL
details     JSONB DEFAULT '{}'
created_at  TIMESTAMPTZ DEFAULT now()
```

#### `reports` (member-submitted content reports)
```sql
id            UUID PRIMARY KEY DEFAULT gen_random_uuid()
reporter_id   UUID REFERENCES profiles(id) NOT NULL
reported_type TEXT NOT NULL                -- 'message' or 'user'
reported_id   TEXT NOT NULL
server_id     UUID REFERENCES servers(id)
category      TEXT NOT NULL                -- spam, harassment, nsfw, misinformation, other
description   TEXT DEFAULT ''
status        TEXT DEFAULT 'pending'       -- pending, reviewing, resolved, dismissed
reviewed_by   UUID REFERENCES profiles(id)
resolution    TEXT DEFAULT ''
created_at    TIMESTAMPTZ DEFAULT now()
resolved_at   TIMESTAMPTZ
```

#### `mutes` (temporary member silencing)
```sql
server_id   UUID REFERENCES servers(id) ON DELETE CASCADE
user_id     UUID REFERENCES profiles(id) ON DELETE CASCADE
muted_by    UUID REFERENCES profiles(id) NOT NULL
reason      TEXT DEFAULT ''
expires_at  TIMESTAMPTZ                    -- null = permanent
created_at  TIMESTAMPTZ DEFAULT now()
PRIMARY KEY (server_id, user_id)
```

#### `polls`, `poll_options`, `poll_votes`
```sql
-- polls
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
message_id      UUID UNIQUE REFERENCES messages(id) ON DELETE CASCADE NOT NULL
question        TEXT NOT NULL               -- 1-300 chars
allow_multiple  BOOLEAN DEFAULT false
closes_at       TIMESTAMPTZ
created_at      TIMESTAMPTZ DEFAULT now()

-- poll_options
id        UUID PRIMARY KEY DEFAULT gen_random_uuid()
poll_id   UUID REFERENCES polls(id) ON DELETE CASCADE NOT NULL
text      TEXT NOT NULL                     -- 1-100 chars
position  INT DEFAULT 0

-- poll_votes
poll_id   UUID REFERENCES polls(id) ON DELETE CASCADE
option_id UUID REFERENCES poll_options(id) ON DELETE CASCADE
user_id   UUID REFERENCES profiles(id) ON DELETE CASCADE
PRIMARY KEY (poll_id, option_id, user_id)
```

#### `events`, `event_rsvps`
```sql
-- events
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
server_id   UUID REFERENCES servers(id) ON DELETE CASCADE NOT NULL
channel_id  UUID REFERENCES channels(id) ON DELETE SET NULL
creator_id  UUID REFERENCES profiles(id) NOT NULL
title       TEXT NOT NULL                   -- 1-200 chars
description TEXT DEFAULT ''
starts_at   TIMESTAMPTZ NOT NULL
ends_at     TIMESTAMPTZ
location    TEXT DEFAULT ''
created_at  TIMESTAMPTZ DEFAULT now()

-- event_rsvps
event_id  UUID REFERENCES events(id) ON DELETE CASCADE
user_id   UUID REFERENCES profiles(id) ON DELETE CASCADE
status    TEXT DEFAULT 'going'              -- going, maybe, not_going
PRIMARY KEY (event_id, user_id)
```

### Future Tables (reserved)
- `custom_emojis` — community emoji uploads
- `webhooks` — external integrations
- `automod_rules` — automated moderation rules (word filter, spam detection)
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

#### Roles & Permissions (v1 — being replaced)
- [x] Role hierarchy: Owner > Admin > Moderator > Member
- [x] Owner: full control, transfer ownership, delete server
- [x] Admin: manage channels, manage roles (below admin), manage members
- [x] Moderator: delete messages, mute/kick users, pin messages
- [x] Member: send messages, react, upload files
- [x] Per-channel permission overrides (future — keep schema flexible)

#### Roles & Permissions (v2 — M11)
- [ ] Custom named roles with granular permission bitfields
- [ ] Multiple roles per user (many-to-many)
- [ ] Per-channel role overrides (allow/deny per permission)
- [ ] Permission presets (Admin, Moderator, Member templates)
- [ ] Role ordering (position-based hierarchy)
- [ ] System roles (owner role cannot be deleted)
- [ ] `ADMINISTRATOR` permission bypasses all checks

**Permission Categories:**
- Community: `MANAGE_SPACE`, `MANAGE_ROLES`, `MANAGE_INVITES`, `VIEW_AUDIT_LOG`
- Channels: `VIEW_CHANNEL`, `MANAGE_CHANNELS`, `MANAGE_CATEGORIES`
- Messaging: `SEND_MESSAGES`, `ATTACH_FILES`, `EMBED_LINKS`, `MENTION_EVERYONE`, `MANAGE_MESSAGES`, `ADD_REACTIONS`
- Moderation: `KICK_MEMBERS`, `BAN_MEMBERS`, `MUTE_MEMBERS`, `MANAGE_BANS`
- Members: `CHANGE_NICKNAME`, `MANAGE_NICKNAMES`

#### Moderation (v1 — complete)
- [x] Kick user from server
- [x] Ban user from server (with reason)
- [x] Unban user
- [x] Delete any message (mod+)
- [x] Slowmode per channel

#### Moderation (v2 — M13)
- [ ] Audit log (who did what, when, immutable)
- [ ] Report system (message + user reports with categories)
- [ ] Mod queue (pending reports, review actions)
- [ ] Mute system (timed or permanent, blocks messaging)
- [ ] Auto-moderation (word filter, spam detection)

#### Search
- [x] Full-text message search within server
- [x] Filter by channel, author, date range
- [x] Search results with context and jump-to-message

### Planned Features (M11-M15)

#### Community Architecture (M11-M12)
- [ ] Custom roles with granular permissions (M11)
- [ ] Community settings entity (branding, registration mode, rules) (M12)
- [ ] Server → Space rename throughout UI (M12)
- [ ] Space visibility: public, private, restricted (M12)
- [ ] Community sidebar with branded header + space list (M12)
- [ ] Onboarding flow: landing page, welcome screen, rules acceptance (M12)

#### Moderation & Safety (M13)
- [ ] Audit log for all moderation actions
- [ ] Report system (message + user, categorized)
- [ ] Mod queue with review workflow
- [ ] Mute system (timed + permanent)
- [ ] Auto-moderation (word filter, spam detection)

#### Engagement (M14)
- [ ] Threads (lightweight channels spawned from messages)
- [ ] Polls (embedded in messages, multi-option, optional expiry)
- [ ] Events (date, description, RSVP)
- [ ] Announcement spaces (restricted posting)

#### Real-time & Production (M15)
- [ ] Supabase Realtime for messages (INSERT/UPDATE/DELETE)
- [ ] Supabase Realtime Presence (replace localStorage)
- [ ] Supabase Realtime Broadcast (typing indicators)
- [ ] Complete RLS policies for all new tables

### Future Features (post-M15)
- Voice/video channels (WebRTC)
- Custom emoji uploads
- Webhooks & bot API
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

### Completed: M1-M10

- **M1**: Project scaffold, auth, profiles, backend adapter
- **M2**: Server & channel CRUD, member system
- **M3**: Messaging (send/edit/delete, replies, grouping)
- **M4**: Presence, typing indicators, unread tracking
- **M5**: Direct messages (1:1 conversations)
- **M6**: @mentions, notification badges, browser notifications
- **M7**: Emoji reactions, message pinning
- **M8**: Channel categories, drag-drop reorder, slowmode
- **M9**: Role-based permissions (fixed hierarchy), kick & ban
- **M9.5**: Toast system, context menus, markdown, search, polish
- **M10**: Local Supabase dev setup, Supabase bugfixes

### M11: Roles & Permissions Engine

Replace hardcoded role hierarchy with custom roles + permission bitfields:
- Permission bitfield library (`src/lib/permissions.ts`)
- `roles`, `user_roles`, `channel_role_overrides` tables
- Backend interface + implementations for both adapters
- Roles store + composables (`useRoles`, `usePermissions`)
- Migrate all UI permission checks to `can(Permission.X)`
- Role management UI (create/edit/delete, drag-to-reorder, color picker)
- New RLS policies using `user_has_permission()` function

### M12: Spaces & Community Identity

Reframe app as single community with spaces:
- `community_settings` entity (branding, registration mode, rules)
- Server → Space rename in all UI text and routes
- Space visibility (public/private/restricted) and types (general/announcement/archive)
- Community sidebar redesign (branded header + space list)
- Community admin panel
- Onboarding flow (landing page, welcome screen, rules acceptance)
- Space access control (role-based join gating)

### M13: Moderation & Safety

Trust and safety infrastructure:
- Audit log (immutable record of all moderation actions)
- Report system (message + user, categorized)
- Mod queue (review pending reports)
- Mute system (timed or permanent)
- Auto-moderation (word filter, spam detection)

### M14: Engagement Features

Community engagement:
- Threads (lightweight channels spawned from messages)
- Polls (embedded in messages)
- Events (creation, RSVP, calendar)
- Announcement spaces (restricted posting)

### M15: Supabase Real-time & Integration

Production readiness:
- Supabase Realtime for messages, presence, typing
- RLS policies for all new tables
- Complete Supabase backend for all new namespaces
- End-to-end testing

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
