# Project Architecture — Protosphere Community Platform

> **Authoritative architecture reference** — extracted from `PROJECT_SPECIFICATIONS.md`
> This file supersedes any generic `ARCHITECTURE.md` template.

---

## Vision

The central communication hub for a single online community. Protosphere provides **spaces** (sub-communities) within one shared identity, a **custom role system** with granular permissions, community **branding and onboarding**, robust **moderation tools**, a **first-class forum** with a visual block editor, and **engagement features** (polls, events). Also serves as the **unified identity hub** for all future services (TypeScript course, web games, etc.).

---

## Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Frontend** | Vue 3 + TypeScript 5.9 | Preferred stack, shared with TypeScript course |
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
│         community.domain.com                    │
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

### Core Tables (existing)

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `profiles` | User profiles (extends `auth.users`) | username, display_name, avatar_url, status, bio |
| `servers` | Spaces (sub-communities) | name, owner_id, invite_code, visibility, space_type |
| `channels` | Text channels within spaces | server_id, name, type, position, is_default, slowmode_seconds, category_id |
| `channel_categories` | Channel grouping | server_id, name, position |
| `messages` | Channel messages | channel_id, author_id, content (markdown), reply_to_id, attachments (JSONB) |
| `members` | Space membership | server_id, user_id, nickname (role column deprecated) |
| `reactions` | Emoji reactions on messages | message_id, user_id, emoji |
| `channel_read_state` | Unread tracking | channel_id, user_id, last_read_at, mention_count |
| `direct_message_groups` | DM conversations | name, is_group |
| `direct_message_members` | DM group membership | dm_group_id, user_id |
| `direct_messages` | DM messages | dm_group_id, author_id, content |
| `bans` | Space bans | server_id, user_id, banned_by, reason |

### Community & Identity Tables (M12)

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `community_settings` | Single-row instance config | name, logo_url, banner_url, registration_mode, rules, welcome_message |

### Roles & Permissions Tables (M11)

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `roles` | Per-space custom roles | server_id, name, color, position, permissions (BIGINT bitfield), is_default, is_system |
| `user_roles` | Many-to-many role assignment | user_id, role_id |
| `channel_role_overrides` | Per-channel permission tweaks | channel_id, role_id, allow, deny |

### Moderation Tables (M13)

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `audit_log` | Immutable action record | server_id, actor_id, action, target_type, target_id, details (JSONB) |
| `reports` | Content reports | reporter_id, reported_type, reported_id, category, status |
| `mutes` | Temporary silencing | server_id, user_id, muted_by, reason, expires_at |
| `automod_rules` | Automated moderation | server_id, rule_type, config (JSONB), action, enabled |

### Engagement Tables (M14)

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `polls` | Embedded polls in messages | message_id, question, allow_multiple, closes_at |
| `poll_options` | Poll choices | poll_id, text, position |
| `poll_votes` | User votes | poll_id, option_id, user_id |
| `events` | Community events | server_id, title, starts_at, ends_at, location |
| `event_rsvps` | Event RSVPs | event_id, user_id, status (going/maybe/not_going) |

### Forum Tables (M22–M23)

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `forum_posts` | Forum posts (meta or page type) | server_id, channel_id, author_id, title, post_type, content (JSONB), vote_score |
| `forum_comments` | Threaded comments on forum posts | post_id, author_id, content, parent_comment_id, vote_score, is_deleted |
| `forum_post_votes` | Up/down votes on posts | post_id, user_id, value (+1/-1) |

### Retention & Notifications (M20–M21)

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `message_attachments` | File attachments metadata | message_id, filename, content_type, storage_path, public_url |
| `dm_notification_preferences` | DM mute settings per user | dm_group_id, user_id, mute_level |
| `notification_preferences` | Per-channel notification level | channel_id, user_id, level |

### Auth & Identity (M17–M19 + post-M25)

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `community_invites` | Invite tokens for invite-only mode | token, created_by, used_by, expires_at |
| `direct_message_groups` | DM conversations | id, name, is_group |
| `direct_message_members` | DM group membership | dm_group_id, user_id |

### Integrations Framework (post-M25)

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `integrations` | Registered external apps | name, slug, api_base_url, data_endpoint, auth_mode, ttl_seconds, api_key, app_url, signing_key, enabled |
| `integration_field_schemas` | Fields defined per integration | integration_id, field_key, label, type, visibility_default |
| `user_integrations` | Per-user account connections | integration_id, user_id, synced_data (JSONB), synced_at, external_user_id |
| `user_field_visibility` | Per-user per-field visibility | user_integration_id, field_key, visibility (public/private/hidden) |
| `space_integration_requirements` | Per-space recommended integrations | server_id, integration_id |

### Key Indexes

- `messages(channel_id, created_at DESC)` — primary query pattern
- `audit_log(server_id, created_at DESC)` — moderation queries
- `direct_messages(dm_group_id, created_at DESC)` — DM queries

---

## Permission System (M11)

### Permission Bitfield

Permissions are stored as BIGINT bitfields on `roles.permissions`. User's effective permissions = union of all assigned role permissions, minus per-channel denies, plus per-channel allows.

```
Community:  MANAGE_SPACE, MANAGE_ROLES, MANAGE_INVITES, VIEW_AUDIT_LOG
Channels:   VIEW_CHANNEL, MANAGE_CHANNELS, MANAGE_CATEGORIES
Messaging:  SEND_MESSAGES, ATTACH_FILES, EMBED_LINKS, MENTION_EVERYONE,
            MANAGE_MESSAGES, ADD_REACTIONS
Moderation: KICK_MEMBERS, BAN_MEMBERS, MUTE_MEMBERS, MANAGE_BANS
Members:    CHANGE_NICKNAME, MANAGE_NICKNAMES
Admin:      ADMINISTRATOR (bypasses all checks)
```

### Permission Resolution

```
1. Collect all roles assigned to user for the space
2. Merge role permissions (bitwise OR)
3. If ADMINISTRATOR bit set → grant all permissions
4. Apply channel overrides: (base | allow) & ~deny
5. Final bitfield = effective permissions for user in channel
```

### Default Roles (created per space)

| Role | Preset Permissions |
|------|--------------------|
| Owner | ADMINISTRATOR (system role, cannot be deleted) |
| Admin | All except ADMINISTRATOR |
| Moderator | MANAGE_MESSAGES, KICK_MEMBERS, BAN_MEMBERS, MUTE_MEMBERS, MANAGE_BANS + messaging |
| Member | SEND_MESSAGES, ATTACH_FILES, EMBED_LINKS, ADD_REACTIONS, CHANGE_NICKNAME + VIEW_CHANNEL |

---

## Authentication & Unified Identity

### Auth Flow

1. User signs up via Supabase Auth (email/password or OAuth)
2. Database trigger creates `profiles` row (username from metadata or email prefix)
3. JWT issued, stored client-side
4. All API calls include JWT — Supabase RLS validates per-row

### OAuth Providers

- GitHub (primary audience: developers)
- Google (broad accessibility)
- Email/password (fallback)

### Registration Modes (M12)

- **Open**: anyone can register
- **Approval**: registration creates pending request, admin approves
- **Invite-only**: requires invite link to register
- **Closed**: no new registrations

### Unified Identity Across Services

- Single Supabase project = single auth instance
- Each service is a separate frontend SPA on different subdomain
- All services read from the same `profiles` table
- Service-specific data lives in service-specific tables

---

## Real-time Architecture

### Supabase Realtime Channels (M15)

| Purpose | Mechanism | Channel name |
|---------|-----------|-------------|
| Channel messages | Postgres Changes (INSERT/UPDATE/DELETE on `messages`) | `messages:{channelId}` |
| DM messages | Postgres Changes on `direct_messages` | `dm_messages:{groupId}` |
| Global presence | Supabase Presence (started once in AppShell on login) | `presence:community` |
| Typing indicators | Supabase Broadcast (ephemeral, per-channel) | `typing:{channelId}` |

### Connection Strategy

- One WebSocket connection per Supabase client (multiplexed)
- Subscribe to channels on navigation (enter space → subscribe to its channels)
- Unsubscribe on leave
- Reconnect with exponential backoff

---

## Row Level Security (RLS)

### Policy Summary (v1 — existing)

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| `profiles` | Anyone | Via auth trigger | Own profile only | — |
| `messages` | Space members | Non-banned members (own author_id) | Own messages | Own or mod+ |
| `members` | Space members | Via invite flow | Role changes (admin+) | Leave or admin+ |
| `servers` | Public or members | Authenticated | Owner only | Owner only |
| `channels` | Space members | Admin+ | Admin+ | Admin+ |
| `reactions` | Space members | Members (own) | — | Own only |
| `bans` | Mod+ | Mod+ | — | Admin+ |

### Policy Summary (v2 — M11/M15)

RLS policies will use `user_has_permission(server_id, user_id, permission_bit)` function that queries `user_roles` + `roles` + `channel_role_overrides` to evaluate permissions from the bitfield system.

---

## UI Architecture

### Layout Structure (current)

```
┌──────────────────────────────────────────────────────────┐
│  Top Bar (user avatar, search, settings, notifications)  │
├─────┬────────────┬───────────────────────────┬───────────┤
│  S  │  Channel   │     Message Area          │  Member   │
│  p  │  List      │                           │  List     │
│  a  │            │                           │           │
│  c  │  #general  │  Messages...              │  @user1   │
│  e  │  #help     │                           │  @user2   │
│     │  #random   │                           │  @user3   │
│  S  │            │                           │           │
│  i  │  ────────  │  ┌─────────────────────┐  │           │
│  d  │  DMs       │  │ Message Input       │  │           │
│  e  │            │  └─────────────────────┘  │           │
│  b  │            │                           │           │
│  a  │            │                           │           │
│  r  │            │                           │           │
├─────┴────────────┴───────────────────────────┴───────────┤
│  Status Bar (typing indicators)                          │
└──────────────────────────────────────────────────────────┘
```

### Layout Structure (M12 — community sidebar)

```
┌──────────────────────────────────────────────────────────┐
│  Community Header (logo + name)                          │
├──────────────┬────────────┬──────────────────┬───────────┤
│  Space       │  Channel   │  Message Area    │  Member   │
│  List        │  List      │                  │  List     │
│              │            │                  │           │
│  Public      │  #general  │  Messages...     │  @user1   │
│  ─ general   │  #help     │                  │  @user2   │
│  ─ help      │            │                  │           │
│  ─ showcase  │            │                  │           │
│              │            │                  │           │
│  Private     │  ───────── │  ┌────────────┐  │           │
│  ─ staff     │            │  │ Input      │  │           │
│  ─ vip       │            │  └────────────┘  │           │
│              │            │                  │           │
│  [Browse]    │            │                  │           │
│  [Create]    │            │                  │           │
├──────────────┴────────────┴──────────────────┴───────────┤
│  User bar (avatar, status, settings)                     │
└──────────────────────────────────────────────────────────┘
```

### Design System

- Dark theme (slate-950 bg, slate-50 text)
- Shared Tailwind `@theme` tokens with TypeScript course
- Same font stack (Inter/system)
- Presence colors: green=online, yellow=idle, red=DND, gray=offline
- Role colors: custom hex per role, displayed on names

---

## Directory Structure

```
src/
├── components/
│   ├── layout/          -- AppShell, CommunitySidebar, ChannelSidebar, MemberSidebar
│   ├── chat/            -- EmojiPicker, MessageSearch, MessageAttachments
│   ├── dm/              -- DmConversationPane
│   ├── forum/           -- ForumPostCard, ForumCommentsPanel, ForumCommentTree, BlockEditor, BlockRenderer
│   ├── server/          -- CreateServerDialog, JoinServerDialog, ChannelPermissionsPanel
│   ├── user/            -- UserAvatar, PresenceIndicator, UserProfileModal, SetupWizard, OnboardingTour
│   ├── moderation/      -- AuditLogViewer, ReportDialog
│   ├── integrations/    -- AdminIntegrationsPage sub-components
│   └── ui/              -- ContextMenu, ToastContainer, ConfirmDialog, SkeletonLoader, EmptyState
├── composables/
│   ├── useAuth.ts, useProfile.ts, useServers.ts, useChannels.ts, useMessages.ts
│   ├── usePresence.ts, useTyping.ts, useReactions.ts, useUnread.ts, useDMs.ts
│   ├── useMembers.ts, useCategories.ts, useMentions.ts, useMessageSearch.ts, useDmUnread.ts
│   ├── useRoles.ts, usePermissions.ts
│   ├── useCommunity.ts
│   ├── useAuditLog.ts, useReports.ts, useMutes.ts
│   ├── usePolls.ts, useEvents.ts
│   ├── useRealtime.ts, useSidebarPanel.ts, useSessionSync.ts
│   ├── useForumPosts.ts, useForumComments.ts
│   ├── useIntegrations.ts, useUserIntegrations.ts, useSpaceRequirements.ts
│   ├── useNotificationPreferences.ts, useDmNotificationPreferences.ts
│   └── useAdminStats.ts
├── stores/
│   ├── auth.ts, servers.ts, channels.ts, messages.ts, dms.ts, ui.ts
│   ├── reactions.ts, mentions.ts, categories.ts, toast.ts, contextMenu.ts
│   ├── roles.ts, community.ts, reports.ts, presence.ts, dmTabs.ts
│   └── polls.ts, events.ts
├── lib/
│   ├── supabase.ts, types.ts, markdown.ts, mentions.ts, contextMenuItems.ts
│   ├── permissions.ts, auditLog.ts, automod.ts
│   └── backend/ -- types.ts, index.ts, local.ts, supabase-backend.ts
├── pages/
│   ├── LoginPage.vue, RegisterPage.vue, DMPage.vue, SettingsPage.vue
│   ├── ServerPage.vue, ServerSettingsPage.vue, InvitePage.vue
│   ├── LandingPage.vue, CommunitySettingsPage.vue
│   ├── ModQueuePage.vue, AdminApprovalsPage.vue, AdminDashboardPage.vue
│   ├── AdminIntegrationsPage.vue
│   ├── ResetPasswordPage.vue, ConfirmEmailPage.vue, AuthBridgePage.vue
│   ├── JoinCommunityPage.vue, MemberDirectoryPage.vue
│   ├── UserProfilePage.vue
│   └── NotFoundPage.vue, ErrorPage.vue
└── router.ts
```

---

## Routing

### Current Routes

```
/                                   -- landing page (public)
/login                              -- login page
/register                           -- registration page
/reset-password                     -- password reset completion
/confirm-email                      -- email verification handler
/auth/bridge                        -- auth bridge federated login
/channels/@me                       -- DM list (home)
/channels/@me/:dmGroupId            -- DM conversation
/spaces/:spaceId/:channelId         -- space channel view
/settings                           -- user settings
/spaces/:spaceId/settings           -- space settings
/invite/:code                       -- join via invite
/join/:token                        -- join via community invite token
/community/members                  -- member directory
/u/:username                        -- user profile page
/admin                              -- admin dashboard
/admin/community                    -- community settings
/admin/modqueue                     -- mod queue
/admin/approvals                    -- registration approvals
/admin/integrations                 -- integrations management
/404                                -- not found page
* → /404                            -- catch-all
```

---

## Milestone Dependencies

```
M11 (Roles & Permissions) ──┐
                             ├─→ M13 (Moderation) ──┐
M12 (Spaces & Community) ───┤                       ├─→ M15 (Real-time) ──→ M16–M19 ──→ M20 ──→ M21 ──→ M22 ──→ M23 ──→ M24 ──→ M25 ──→ Integrations
                             └─→ M14 (Engagement) ──┘
```

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
- **Permission caching**: Computed permissions cached per space, invalidated on role change

---

## Cross-Service Integration (Post-M15)

- TypeScript course frontend swaps localStorage auth for Supabase Auth
- Same JWT / user ID across all services
- Auto-create `#typescript-course` channel in a public learning space
- Course progress achievements post to chat (opt-in)
- Each new service gets: own static frontend on subdomain, own tables in shared Supabase project, access to same `profiles` + `auth.users`

---

*Extracted from PROJECT_SPECIFICATIONS.md — Protosphere Architecture Document*
