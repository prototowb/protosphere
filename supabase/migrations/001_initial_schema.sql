-- 001_initial_schema.sql
-- Initial database schema for protosphere
-- Run against Supabase via Dashboard SQL editor or CLI

-- =============================================================================
-- profiles (extends auth.users)
-- =============================================================================
CREATE TABLE profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username        TEXT UNIQUE NOT NULL
                    CONSTRAINT username_format CHECK (username ~ '^[a-zA-Z0-9_]{3,32}$'),
  display_name    TEXT NOT NULL
                    CONSTRAINT display_name_length CHECK (char_length(display_name) BETWEEN 1 AND 48),
  avatar_url      TEXT,
  status          TEXT NOT NULL DEFAULT 'offline'
                    CONSTRAINT valid_status CHECK (status IN ('online', 'idle', 'dnd', 'offline')),
  status_text     TEXT NOT NULL DEFAULT ''
                    CONSTRAINT status_text_length CHECK (char_length(status_text) <= 128),
  bio             TEXT NOT NULL DEFAULT ''
                    CONSTRAINT bio_length CHECK (char_length(bio) <= 500),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- servers
-- =============================================================================
CREATE TABLE servers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL
                    CONSTRAINT server_name_length CHECK (char_length(name) BETWEEN 1 AND 100),
  description     TEXT NOT NULL DEFAULT ''
                    CONSTRAINT server_desc_length CHECK (char_length(description) <= 1000),
  icon_url        TEXT,
  owner_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  invite_code     TEXT UNIQUE,
  is_public       BOOLEAN NOT NULL DEFAULT false,
  member_count    INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- channels
-- =============================================================================
CREATE TABLE channels (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id       UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  name            TEXT NOT NULL
                    CONSTRAINT channel_name_length CHECK (char_length(name) BETWEEN 1 AND 50),
  description     TEXT NOT NULL DEFAULT '',
  type            TEXT NOT NULL DEFAULT 'text'
                    CONSTRAINT valid_channel_type CHECK (type IN ('text')),
  position        INT NOT NULL DEFAULT 0,
  is_default      BOOLEAN NOT NULL DEFAULT false,
  slowmode_seconds INT NOT NULL DEFAULT 0
                    CONSTRAINT valid_slowmode CHECK (slowmode_seconds >= 0),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(server_id, name)
);

-- =============================================================================
-- messages
-- =============================================================================
CREATE TABLE messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id      UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  author_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  content         TEXT NOT NULL
                    CONSTRAINT message_content_length CHECK (char_length(content) BETWEEN 1 AND 4000),
  edited_at       TIMESTAMPTZ,
  reply_to_id     UUID REFERENCES messages(id) ON DELETE SET NULL,
  attachments     JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_pinned       BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_channel_created ON messages (channel_id, created_at DESC);

-- =============================================================================
-- members (server membership + roles)
-- =============================================================================
CREATE TABLE members (
  server_id       UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role            TEXT NOT NULL DEFAULT 'member'
                    CONSTRAINT valid_role CHECK (role IN ('owner', 'admin', 'moderator', 'member')),
  nickname        TEXT
                    CONSTRAINT nickname_length CHECK (nickname IS NULL OR char_length(nickname) BETWEEN 1 AND 48),
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (server_id, user_id)
);

-- =============================================================================
-- reactions
-- =============================================================================
CREATE TABLE reactions (
  message_id      UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  emoji           TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id, emoji)
);

-- =============================================================================
-- channel_read_state
-- =============================================================================
CREATE TABLE channel_read_state (
  channel_id      UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  last_read_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  mention_count   INT NOT NULL DEFAULT 0,
  PRIMARY KEY (channel_id, user_id)
);

-- =============================================================================
-- direct_message_groups
-- =============================================================================
CREATE TABLE direct_message_groups (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT,
  is_group        BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- direct_message_members
-- =============================================================================
CREATE TABLE direct_message_members (
  dm_group_id     UUID NOT NULL REFERENCES direct_message_groups(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (dm_group_id, user_id)
);

-- =============================================================================
-- direct_messages
-- =============================================================================
CREATE TABLE direct_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dm_group_id     UUID NOT NULL REFERENCES direct_message_groups(id) ON DELETE CASCADE,
  author_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  content         TEXT NOT NULL
                    CONSTRAINT dm_content_length CHECK (char_length(content) BETWEEN 1 AND 4000),
  edited_at       TIMESTAMPTZ,
  attachments     JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_direct_messages_group_created ON direct_messages (dm_group_id, created_at DESC);

-- =============================================================================
-- bans
-- =============================================================================
CREATE TABLE bans (
  server_id       UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  banned_by       UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  reason          TEXT NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (server_id, user_id)
);
